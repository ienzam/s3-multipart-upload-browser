/**
 * S3MultiUpload Object
 * Create a new instance with new S3MultiUpload(file, otherInfo)
 * To start uploading, call start()
 * You can pause with pause()
 * Resume with resume()
 * Cancel with cancel()
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
    this.progress = [];

    if (console && console.log) {
        this.log = console.log;
    } else {
        this.log = function() {
        };
    }
}


    /** private */
    S3MultiUpload.prototype.createMultipartUpload = function() {
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
    S3MultiUpload.prototype.start = function() {
        this.uploadPart(0);
    };

    /** private */
    S3MultiUpload.prototype.uploadPart = function(partNum) {
        var blobs = this.blobs = [], promises = [];
        var start = 0;
        var end, blob;

        this.curUploadInfo.partNum = partNum;

        if (this.curUploadInfo.partNum === 0) {
            this.createMultipartUpload();
            return;
        }

        if (start > this.file.size) {
            this.completeMultipartUpload();
            return;
        }
        while(start < this.file.size) {
            start = this.PART_SIZE * this.curUploadInfo.partNum++;
            end = Math.min(start + this.PART_SIZE, this.file.size);
            blobs.push(this.file.slice(start, end));
        }

        for (var i = 0; i < blobs.length; i++) {
            blob = blobs[i];
            promises.push($.get(this.SERVER_LOC, {
                command: 'SignUploadPart',
                sendBackData: this.sendBackData,
                partNumber: this.curUploadInfo.partNum,
                contentLength: blob.size
            }));
        }

        // we need to pass $.when an array of arguments
        // so we are using .apply()
        $.when.apply(null, promises)
         .then(this.sendAll.bind(this), this.onServerError);
    };

    S3MultiUpload.prototype.sendAll = function() {
        var blobs = this.blobs;
        var length = blobs.length;
        for (var i = 0; i < length; i++) {
            // sendToS3( XHRresponse, blob);
            this.sendToS3(arguments[i][0], blobs[i], i);
        }
    };
    /** private */
    S3MultiUpload.prototype.sendToS3 = function(data, blob, index) {
        var self = this;
        var url = data['url'];
        var size = blob.size;
        var authHeader = data['authHeader'];
        var dateHeader = data['dateHeader'];
        var request = self.uploadXHR = new XMLHttpRequest();
        request.onreadystatechange = function() {
            if (request.readyState === 4) {
                self.uploadXHR = null;
                self.progress[index] = 100;
                if (request.status !== 200) {
                    self.updateProgressBar();
                    if (!self.isPaused)
                        self.onS3UploadError(request);
                    return;
                }
                self.uploadedSize += blob.size;
                self.updateProgressBar();
            }
        };

        request.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                self.progress[index] = e.loaded / size;
                self.updateProgressBar();
            }
        };
        request.open('PUT', url, true);
        request.setRequestHeader("x-amz-date", dateHeader);
        request.setRequestHeader("Authorization", authHeader);
        request.send(blob);
    };

    /**
     * Pause the upload
     * Remember, the current progressing part will fail,
     * that part will start from beginning (< 5MB of uplaod is wasted)
     */
    S3MultiUpload.prototype.pause = function() {
        this.isPaused = true;
        if (this.uploadXHR !== null) {
            this.uploadXHR.abort();
        }
    };

    /**
     * Resumes the upload
     *
     */
    S3MultiUpload.prototype.resume = function() {
        this.isPaused = false;
        this.uploadPart(this.curUploadInfo.partNum);
    };

    S3MultiUpload.prototype.cancel = function() {
        var self = this;
        self.pause();
        $.get(self.SERVER_LOC, {
            command: 'AbortMultipartUpload',
            sendBackData: self.sendBackData
        }).done(function(data) {

        });
    };

    S3MultiUpload.prototype.waitRetry = function() {
        var self = this;
        window.setTimeout(function() {
            self.retry();
        }, this.RETRY_WAIT_SEC * 1000);
    };

    S3MultiUpload.prototype.retry = function() {
        if (!this.isPaused && self.uploadXHR === null) {
            this.uploadPart(this.curUploadInfo.partNum);
        }
    };

    /** private */
    S3MultiUpload.prototype.completeMultipartUpload = function() {
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
    S3MultiUpload.prototype.updateProgressBar = function() {
        var progress = this.progress;
        var length = progress.length;
        var total = 0;
        for (var i = 0; i < progress.length; i++) {
            total = total + progress[i];
        }
        total = total / length;

        this.onProgressChanged(this.uploadingSize, total, this.file.size);
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
    S3MultiUpload.prototype.onServerError = function(command, jqXHR, textStatus, errorThrown) {
    };

    /**
     * Overrride this function to catch errors occured when uploading to S3
     * If this occurs, we retry upload after RETRY_WAIT_SEC seconds
     * Most of the time you don't need to override this, except for informing user that upload of a part failed
     *
     * @param XMLHttpRequest xhr the XMLHttpRequest object
     */
    S3MultiUpload.prototype.onS3UploadError = function(xhr) {
        self.waitRetry();
    };

    /**
     * Override this function to show user update progress
     *
     * @param {type} uploadingSize is the current upload part
     * @param {type} uploadedSize is already uploaded part
     * @param {type} totalSize the total size of the uploading file
     */
    S3MultiUpload.prototype.onProgressChanged = function(uploadingSize, uploadedSize, totalSize) {
        this.log("uploadedSize = " + uploadedSize);
        this.log("uploadingSize = " + uploadingSize);
        this.log("totalSize = " + totalSize);
    };

    /**
     * Override this method to execute something when upload finishes
     *
     */
    S3MultiUpload.prototype.onUploadCompleted = function(serverData) {

    };
