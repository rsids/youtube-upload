(function () {
    'use strict';

    const argv = require('yargs').argv;
    const co = require('co');
    const fs = require('fs');
    const GoogleCliAuth = require('google-cli-auth');
    const ProgressBar = require('progressbar');
    const ResumableUpload = require('node-youtube-resumable-upload');
    const winston = require('winston');

    winston.add(winston.transports.File, {filename: 'uploader.log'});
    winston.remove(winston.transports.Console);
    const watchfolder = argv.watchfolder || 'watchfolder';
    const credentialsFile = argv.credentials || 'credentials.json';

    let credentials;

    co(function* upload() {
        createDirectories();
        credentials = yield getCredentials();
        let file = yield checkWatchfolder();
        if (file) {
            let queued = yield addToQueue(file);
            let token = yield getToken();
            let result = yield loadYT(token, queued);
            if (result === true) {
                moveFile(file, 'queue', 'done');
            }
        }

    });

    function addToQueue(file) {
        return moveFile(file, '.', 'queue');
    }

    function moveFile(file, current, target) {
        return new Promise((result, reject) => {
            fs.rename(`${watchfolder}/${current}/${file}`, `${watchfolder}/${target}/${file}`, (err) => {
                if (err) {
                    reject(err);
                    winston.log('error', 'Could not rename ', {
                        from: `${watchfolder}/${current}/${file}`,
                        to: `${watchfolder}/${target}/${file}`
                    });
                } else {
                    result(`${watchfolder}/${target}/${file}`);
                }
            });
        });
    }

    function createDirectories() {
        let paths = ['queue', 'inprogress', 'done', 'failed'];
        paths.forEach(path => {
            try {
                fs.mkdirSync(`${watchfolder}/${path}`);

            } catch (e) {
                // Exists
            }
        });
    }

    function checkWatchfolder() {
        return new Promise((result, reject) => {
            fs.readdir(watchfolder, (err, files) => {
                if (err) {
                    reject(err);
                } else if (files.length > 0) {
                    // check if item is a file
                    let isFile = false;
                    while (!isFile && files.length > 0) {
                        let file = files.splice(0, 1)[0];
                        if (file.substr(-3).toLowerCase() === 'mp4' && fs.statSync(`${watchfolder}/${file}`).isFile()) {
                            result(file);
                            isFile = true;
                        }
                    }
                } else {
                    reject('no files');
                }
            });

        });
    }

    function getCredentials() {
        return new Promise((result, reject) => {
            fs.readFile(credentialsFile, 'utf8', function (err, data) {
                if (err) {
                    reject(err);
                    winston.log('error', 'Cannot read credentials', err);
                } else {
                    result(JSON.parse(data));
                }
            });

        });
    }

    function getToken() {
        return new Promise((resolve, reject) => {
            GoogleCliAuth({
                name: credentials.name
                , client_id: credentials.client_id
                , client_secret: credentials.client_secret
                , scope: [
                    'https://www.googleapis.com/auth/youtube.upload'
                ] // add scopes
            }, (error, token) => {
                if (!error) {
                    resolve(token);
                } else {
                    reject(error);
                    winston.log('error', 'Could not authenticate', error);
                }
            });
        });
    }

    function loadYT(token, file) {
        let filename = file.split('/').pop();
        let size = fs.statSync(file)['size'];

        let bar = ProgressBar.create()
            .step(filename)
            .setTotal(size)
            .setTick(0);

        let resumeableUpload = new ResumableUpload();
        resumeableUpload.tokens = token;
        resumeableUpload.filepath = file;
        resumeableUpload.metadata = {
            snippet: {
                categoryId: 22,
                title: filename,
                description: ''
            },
            status: {
                privacyStatus: 'private'
            }
        };
        resumeableUpload.retry = 3; // Maximum retries when upload failed.
        return new Promise((resolve, reject) => {
            resumeableUpload.upload();
            resumeableUpload.on('progress', (progress) => {
                winston.log('debug', 'Upload in progress', {progress: progress, total: size});
                bar.setTick(progress);
            });
            resumeableUpload.on('success', () => {
                bar.finish();
                winston.log('info', 'succesful upload', file);
                resolve(true);
            });
            resumeableUpload.on('error', (error) => {
                bar.finish();
                moveFile(file, 'queue', 'failed');
                reject(error);
                winston.log('error', 'error during upload', file, error);
            });

        })
    }

})();
