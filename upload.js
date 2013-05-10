/**
 * S3MultiUpload Object
 * Create a new instance with new S3MultiUpload(file, otherInfo)
 * To start uploading, call start()
 * You can pause with pause()
 * Resume with resume()
 *
 * You can override the following functions (no event emitter :( , description below on the function definition, at the end of the file)
 * onServerError = function(command, jqXHR, textStatus, errorThrown) {}
 * onS3UploadError = function(xhr) {}
 * onProgressChanged = function(uploadingSize, uploadedSize, totalSize) {}
 * onUploadCompleted = function() {}
 *
 * @param {type} file
 * @param {type} otheInfo
 * @returns {MultiUpload}
 */
function S3MultiUpload(file, otheInfo) {
    this.PART_SIZE = 5 * 1024 * 1024; //minimum part size defined by aws s3
    this.SERVER_LOC = 'server.php'; //location of the server
    this.RETRY_WAIT_SEC = 30; //wait before retrying again on upload failure
    this.file = file;
    this.fileInfo = {
        name: this.file.name,
        type: this.file.type,
        size: this.file.size,
        lastModifiedDate: this.file.lastModifiedDate
    };
    this.sendBackData = null;
    this.isPaused = false;
    this.uploadXHR = null;
    this.otherInfo = otheInfo;
    this.uploadedSize = 0;
    this.uploadingSize = 0;
    this.curUploadInfo = {
        blob: null,
        partNum: 0
    };

    if (console && console.log) {
        this.log = console.log;
    } else {
        this.log = function() {
        };
    }

    /** private */
    this.createMultipartUpload = function() {
        var self = this;
        $.get(self.SERVER_LOC, {
            command: 'CreateMultipartUpload',
            fileInfo: self.fileInfo,
            otherInfo: self.otherInfo
        }).done(function(data) {
            self.sendBackData = data;
            self.uploadPart(1);
        }).fail(function(jqXHR, textStatus, errorThrown) {
            self.onServerError('CreateMultipartUpload', jqXHR, textStatus, errorThrown);
        });
    };

    /**
     * Call this function to start uploading to server
     *
     */
    this.start = function() {
        this.uploadPart(0);
    };

    /** private */
    this.uploadPart = function(partNum) {
        var self = this;
        self.curUploadInfo.partNum = partNum;

        if (self.curUploadInfo.partNum == 0) {
            self.createMultipartUpload();
            return;
        }

        var start = (self.curUploadInfo.partNum - 1) * self.PART_SIZE;
        if (start > self.file.size) {
            self.completeMultipartUpload();
            return;
        }

        var end = Math.min(start + self.PART_SIZE, self.file.size);

        self.curUploadInfo.blob = file.slice(start, end);

        $.get(self.SERVER_LOC, {
            command: 'SignUploadPart',
            sendBackData: self.sendBackData,
            partNumber: self.curUploadInfo.partNum,
            contentLength: self.curUploadInfo.blob.size
        }).done(function(data) {
            self.sendToS3(data);
        }).fail(function(jqXHR, textStatus, errorThrown) {
            self.onServerError('SignUploadPart', jqXHR, textStatus, errorThrown);
        });
    };

    /** private */
    this.sendToS3 = function(data) {
        var self = this;
        var url = data['url'];
        var authHeader = data['authHeader'];
        var dateHeader = data['dateHeader'];
        var request = self.uploadXHR = new XMLHttpRequest();
        request.onreadystatechange = function() {
            if (request.readyState === 4) {
                self.uploadXHR = null;
                self.uploadingSize = 0;
                if (request.status !== 200) {
                    self.updateProgressBar();
                    if(!self.isPaused) self.onS3UploadError(request);
                    return;
                }
                self.uploadedSize += self.curUploadInfo.blob.size;
                self.updateProgressBar();
                self.uploadPart(self.curUploadInfo.partNum + 1);
            }
        };

        request.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                self.uploadingSize = e.loaded;
                self.updateProgressBar();
            }
        };
        request.open('PUT', url, true);
        request.setRequestHeader("x-amz-date", dateHeader);
        request.setRequestHeader("Authorization", authHeader);
        request.setRequestHeader("Content-Length", length);
        request.send(self.curUploadInfo.blob);
    };

    /**
     * Pause the upload
     * Remember, the current progressing part will fail,
     * that part will start from beginning (< 5MB of uplaod is wasted)
     */
    this.pause = function() {
        if (this.uploadXHR !== null) {
            this.uploadXHR.abort();
        }
        this.isPaused = true;
    };

    /**
     * Resumes the upload
     *
     */
    this.resume = function() {
        this.isPaused = false;
        this.uploadPart(this.curUploadInfo.partNum);
    };

    this.waitRetry = function() {
        var self = this;
        window.setTimeout(function() {
            self.retry();
        }, this.RETRY_WAIT_SEC * 1000);
    };

    this.retry = function() {
        if (!this.isPaused) {
            this.uploadPart(this.curUploadInfo.partNum);
        }
    };

    /** private */
    this.completeMultipartUpload = function() {
        var self = this;
        $.get(self.SERVER_LOC, {
            command: 'CompleteMultipartUpload',
            sendBackData: self.sendBackData
        }).done(function(data) {
            self.onUploadCompleted(data);
        }).fail(function(jqXHR, textStatus, errorThrown) {
            self.onServerError('CompleteMultipartUpload', jqXHR, textStatus, errorThrown);
        });
    };

    /** private */
    this.updateProgressBar = function() {
        this.onProgressChanged(this.uploadingSize, this.uploadedSize, this.file.size);
    };

    /**
     * Overrride this function to catch errors occured when communicating to your server
     * If this occurs, the program stops, you can retry by retry() or wait and retry by waitRetry()
     *
     * @param {type} command Name of the command which failed,one of 'CreateMultipartUpload', 'SignUploadPart','CompleteMultipartUpload'
     * @param {type} jqXHR jQuery XHR
     * @param {type} textStatus resonse text status
     * @param {type} errorThrown the error thrown by the server
     */
    this.onServerError = function(command, jqXHR, textStatus, errorThrown) {
    };

    /**
     * Overrride this function to catch errors occured when uploading to S3
     * If this occurs, we retry upload after RETRY_WAIT_SEC seconds
     * Most of the time you don't need to override this, except for informing user that upload of a part failed
     *
     * @param XMLHttpRequest xhr the XMLHttpRequest object
     */
    this.onS3UploadError = function(xhr) {
        self.waitRetry();
    };

    /**
     * Override this function to show user update progress
     *
     * @param {type} uploadingSize is the current upload part
     * @param {type} uploadedSize is already uploaded part
     * @param {type} totalSize the total size of the uploading file
     */
    this.onProgressChanged = function(uploadingSize, uploadedSize, totalSize) {
        this.log("uploadedSize = " + uploadedSize);
        this.log("uploadingSize = " + uploadingSize);
        this.log("totalSize = " + totalSize);
    };

    /**
     * Override this method to execute something when upload finishes
     *
     */
    this.onUploadCompleted = function(serverData) {

    };
}
