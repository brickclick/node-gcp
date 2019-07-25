# Google Cloud Print for Node.js
Library to simplify Google Cloud Print calls

### Usage

You will need to set-up a Google Cloud Application, which will grant you an API client ID
and secret. You will also need to have an http server capable of handling an OAuth endpoint/flow, 
and have your URLs registered for your API endpoints. You can do this here:
`https://console.cloud.google.com/apis/credentials`

Get Authorization codes by redirecting your user to:
```
https://accounts.google.com/o/oauth2/auth
	?response_type=code
	&scope=profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloudprint
	&approval_prompt=force
	&access_type=offline
	&client_id=<your client id>
	&redirect_uri=<your redirect URI>
```

Once a user completes the OAuth process, they will be returned to your redirect URI,
with a code that you can exchange for access and refresh tokens.
```javascript
var promiseRequest = require('request-promise');
return promiseRequest({
	method: 'POST',
	url:'https://www.googleapis.com/oauth2/v3/token',
	form: {
		code: <authorization code from oauth>,
		redirect_uri: <your redirect URI>,
		client_id: <your client id>,
		client_secret: <your client secret>,
		grant_type: 'authorization_code'
	}
});
```
At this point you can now start making API calls
```javascript
var CloudPrint = require('node-gcp');
var printClient = new CloudPrint({
	clientId: <your client id>,
	clientSecret: <your client secret>,
	accessToken: <access token from exchange>,
	refreshToken: <refresh token from exchange>
});

printClient.getPrinters()
	.then(function(printers){
	 	console.log(printers);
	});
printClient.print('printer_id', 'print me!', 'text/plain');
```

### Tickets
[Cloud Job Tickets](https://developers.google.com/cloud-print/docs/cdd#cjt) can be submitted using the `settings` parameter. By including a ticket, you can do things like change page margins, orientation, or the number of copies printed. **Tickets must be JSON-encoded strings**, as they are sent with the print job form data directly to Google Cloud Print without modification.

Here's an example:
```javascript
const ticket = {
  version: '1.0',
  print: {
    copies: {
      copies: 3
    },
    page_orientation: {
      type: 'LANDSCAPE'
    },
    margins: {
      top_microns: 0,
      bottom_microns: 0,
      left_microns: 0,
      right_microns: 0
    }
  }
};

const settings = { ticket: JSON.stringify(ticket) };
printClient.print(printer.id, content, contentType, jobName, settings);
```
