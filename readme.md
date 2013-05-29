AWS S3 Multipart Upload from Browser
====================================

What was done here
------------------
I have written some javascript and php code to make big local files to
be uploaded in Amazon S3 server directly, in chunk of 5 MB, so it is
resumable and recover easily from error.

The process is fairly simple. At first js requests the server to create
a multipart upload, then the server returns the result.
Then js starts to uplaod the chunks. It splits the file in chunk of 5MB,
and uploads it. For uploading, it ask for autorization token from the
server and using the token uploads directly to the amazon s3 server.
Currently the upload is serial (one chunk is uploaded at a time), if
some good hearted fellow makes a parallel upload, it will be great!

After all the part has been uploaded, it again asks the server to
complete the multipart upload.
Yes that's all in brief.

Requirements
------------
* User need to have modern browser (with File API, Blob API, and xhr2 support)
Latest Firefox, Chromium, Opera, IE (>= 10) all can do
* PHP server (you can use any backend but mine is php server)
* Composer to download aws-php-sdk

Motivation
----------
I have to upload some large files in Amazon S3.
After googling and reading a bit, I find out I have the following options:
* Upload the file to my server, then to Amazon S3 - didn't like it
* Upload directly to Amazon S3 with post - but chance of upload faling is huge
* Use multipart upload option of Amazon S3 - I likey

But I could not find any good open source and free (free as in bear) api
or even tutorial. So I decided to do it on my own. As my project is on
php, the server part to authenticate the request to aws is done in php.

WARNING
-------
The codes are not well tested, poorly written, and kind of a mess.
You should get inspiration (!) from the code and make your own version.
Server need to have some validation which it currently lacks. Just go
though the code and you will understand the situation :p
This is just like a demonstration, you should customize it as your own
need.

How to use it
-------------
Rename the config.php.dist to config.php and set the constants
accordingly. You also need to run the `composer install` command to
download the aws-php-sdk. Then just open the `upload.html` or
`raw_upload.html` on browser to see the demonstrations (as a server
file, not local file).

Files
-----

* server.php - The server file, it does the creation, completion of
multipart upload. And also it signs the requests to make the browser to
upload the file parts.

* raw_upload.html - This file is the demo of how to connect to the
server, uses jquery (and firebug lite for easy debug viewing), and I am not so
good with javascript, so forgive me for this type of coding :-(

* upload.js - An attempt to make an object out of the javascript part,
the smallest documentation is present in the file

* upload.html - Demonstration of upload.js, if you are too lazy, you can
use this as your starting point.

* Libraries - they are helpers. jquery, firebug_lite, etc. You should
respect their licenses.

License
-------
Actually you can think of this code on public domain :P
Just a mention or gratitude of this work is enough :)
(not needed at all though)

Contributors
------------
@thecolorblue - Brad Davis - https://github.com/thecolorblue

@ienzam - Md. Enzam Hossain - https://github.com/ienzam
