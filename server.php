<?php

function sendJson($arr)
{
    header('Content-Type: application/json');
    die(json_encode($arr));
}

$command = isset($_GET['command']) ? strtolower($_GET['command']) : '';

require 'vendor/autoload.php';
require 'config.php';

use Aws\Common\Enum\DateFormat;
use Aws\S3\Model\MultipartUpload\UploadId;
use Aws\S3\S3Client;

$client = S3Client::factory(array(
        'key' => AWS_KEY,
        'secret' => AWS_SECRET
    ));

function isAllowed()
{
//wow, what a validator :P
//WARNING: this is just a demonstration, convert it to your own need
    return ($_REQUEST['otherInfo']['user'] == 'user' && $_REQUEST['otherInfo']['pass'] == 'pass');
}

switch ($command) {
    case 'createmultipartupload': {
            if (!isAllowed()) {
                header(' ', true, 403);
                die('You are not authorized');
            }

            /* @var $multipartUploadModel UploadId */
            $model = $client->createMultipartUpload(array(
                'Bucket' => BUCKET_NAME,
                'Key' => $_REQUEST['fileInfo']['name'],
                'ContentType' => $_REQUEST['fileInfo']['type'],
                'Metadata' => $_REQUEST['fileInfo']
            ));

            sendJson(array(
                'uploadId' => $model->get('UploadId'),
                'key' => $model->get('Key'),
            ));
            break;
        }
    case 'signuploadpart': {
            $command = $client->getCommand('UploadPart',
                array(
                'Bucket' => BUCKET_NAME,
                'Key' => $_REQUEST['sendBackData']['key'],
                'UploadId' => $_REQUEST['sendBackData']['uploadId'],
                'PartNumber' => $_REQUEST['partNumber'],
                'ContentLength' => $_REQUEST['contentLength']
            ));

            $request = $command->prepare();
            // This dispatch commands wasted a lot of my times :'(
            $client->dispatch('command.before_send', array('command' => $command));
            $request->removeHeader('User-Agent');
            $request->setHeader('x-amz-date', gmdate(DateFormat::RFC2822));
            // This dispatch commands wasted a lot of my times :'(
            $client->dispatch('request.before_send', array('request' => $request));

            sendJson(array(
                'url' => $request->getUrl(),
                'authHeader' => (string) $request->getHeader('Authorization'),
                'dateHeader' => (string) $request->getHeader('x-amz-date'),
            ));
            break;
        }
    case 'completemultipartupload': {
            $partsModel = $client->listParts(array(
                'Bucket' => BUCKET_NAME,
                'Key' => $_REQUEST['sendBackData']['key'],
                'UploadId' => $_REQUEST['sendBackData']['uploadId'],
            ));

            $model = $client->completeMultipartUpload(array(
                'Bucket' => BUCKET_NAME,
                'Key' => $_REQUEST['sendBackData']['key'],
                'UploadId' => $_REQUEST['sendBackData']['uploadId'],
                'Parts' => $partsModel['Parts'],
            ));

            sendJson(array(
                'success' => true
            ));
            break;
        }
    case 'abortmultipartupload': {
            $model = $client->abortMultipartUpload(array(
                'Bucket' => BUCKET_NAME,
                'Key' => $_REQUEST['sendBackData']['key'],
                'UploadId' => $_REQUEST['sendBackData']['uploadId']
            ));

            sendJson(array(
                'success' => true
            ));
            break;
        }
    default: {
            header(' ', true, 404);
            die('Command not understood');
            break;
        }
}