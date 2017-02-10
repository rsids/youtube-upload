# Youtube uploader
Uploads movies to youtube. Authenticates using OAUTH.

## Usage

### Installation
```
npm install
```

###Run 
```
npm start
```
#### Optional parameters
```
--watchfolder=[path]
```
Specifies the path where the videos are located.
Read & write permissions are required on that folder. Defaults to the current folder

```
--credentials=[path]
```
Specified the path to a json file containing private key, default: credentials.json
```
{
    "name": "PROJECT NAME", 
    "client_id": "CLIENT_ID",
    "client_secret": "CLIENT_SECRET"
}
```