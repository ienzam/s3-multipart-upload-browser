<?php

class S3MultiUploadManager {
	private $client;
	private $key;
	function __construct(S3Client $client, $key) {
		$this->client = $client;
		$this->key = $key;
	}

	function initUpload($bucketName, $fileName) {
		return $client->createMultipartUpload(array(
			"ACL" => "public-read",
			"Key" => $fileName,
		));
	}
}