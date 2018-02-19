var preq = require('request-promise'),
	url = require('url'),
	shortid = require('shortid'),
	_ = require('lodash');

var GCPClient = module.exports = function(opts, tokenExpires) {
	this.options = _.defaults(opts, {
		oauthVersion: 'v3'
	});

	if(!this.options.clientId) {
		throw new Error('Missing required parameter: { clientId: \'...\' }');
	}
	if(!this.options.clientSecret) {
		throw new Error('Missing required parameter: { clientSecret: \'...\' }');
	}
	if(!this.options.accessToken) {
		throw new Error('Missing required parameter: { accessToken: \'...\' }');
	}
	if(!this.options.refreshToken) {
		throw new Error('Missing required parameter: { refreshToken: \'...\' }');
	}
};

var failRetry = function(func) {
	return function() {
		var self = this, args = Array.prototype.slice.call(arguments);
		return func.apply(self, args)
			.then(function(result) {
				self.isRetry = false;
				return result;
			})
			.catch(function(err) {
				if(!self.isRetry && err.statusCode == 403) {
					return self._refreshToken()
						.then(function(){
							self.isRetry = true;
							return func.apply(self, args);
						})
				}

				throw err;
			});
	}
};

GCPClient.prototype._refreshToken = function() {
	var self = this;
	return preq({
		method: 'POST',
		uri: 'https://www.googleapis.com/oauth2/' + this.options.oauthVersion + '/token',
		form: {
			'client_id': this.options.clientId,
			'client_secret': this.options.clientSecret,
			'refresh_token': this.options.refreshToken,
			'grant_type': 'refresh_token'
		},
		json: true
	})
	.then(function(result) {
		self.tokenExpires = (Date.now() / 1000 | 0) + result['expires_in'];
		return self.options.accessToken = result['access_token'];
	});
};

GCPClient.prototype.getPrinters = failRetry(function(cb) {
	return preq({
		method: 'POST',
		uri: 'https://www.google.com/cloudprint/search',
		headers: {
			'X-CloudPrint-Proxy': 'node-gcp',
			'Authorization': 'OAuth ' + this.options.accessToken
		},
		json: true
	})
	.then(function(result) {
		var printers = [];
		_.forEach(result.printers, function(printer) {
			printers.push({
				id: printer.id,
				name: printer.displayName,
				description: printer.description,
				type: printer.type,
				status: printer.connectionStatus
			});
		});

		return printers;
	})
	.nodeify(cb);
});

GCPClient.prototype.getPrinter = failRetry(function(id, cb) {
	return preq({
		method: 'POST',
		uri: 'https://www.google.com/cloudprint/printer',
		form: {
			'printerid': id
		},
		headers: {
			'X-CloudPrint-Proxy': 'node-gcp',
			'Authorization': 'OAuth ' + this.options.accessToken
		},
		json: true
	})
			.then(function(result) {
				return result.printers[0];
			})
			.nodeify(cb);
});

GCPClient.prototype.print = failRetry(function(printerId, content, contentType, title, settings, cb) {
	if(_.isPlainObject(printerId)) {
		settings = printerId;
		printerId = null;
		if(_.isFunction(content)) {
			cb = content;
			content = null;
		}
	} else if(_.isFunction(title)) {
		cb = title;
		title = null;
	} else if(_.isFunction(settings)) {
		cb = settings;
		settings = null;
	}
	settings = settings || {};

	if(settings.printerId) {
		settings.printerid = settings.printerId;
		delete settings.printerid;
	}

	settings.title = settings.title || title || 'UNTITLED JOB ' + shortid.generate();
	settings.contentType = settings.contentType || contentType;
	settings.printerid = settings.printerid || printerId;
	settings.content = settings.content || content;

	return preq({
		method: 'POST',
		uri: 'https://www.google.com/cloudprint/submit',
		form: settings,
		headers: {
			'X-CloudPrint-Proxy': 'node-gcp',
			'Authorization': 'OAuth ' + this.options.accessToken
		},
		json: true
	})
	.then(function(result) {
		return result;
	})
	.nodeify(cb);
});
