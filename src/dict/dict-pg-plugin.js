var DictPGPlugin = function (path) {
	this.path = path;
	PhoneGap.addConstructor(function() {
		PhoneGap.addPlugin("dict", this);
	});
};

DictPGPlugin.prototype.open = function(clean, handler) {
	PhoneGap.exec(function () {
		handler(null);
	}, function (err) {
		handler(err || 'Phonegap error');
	}, 'Dict', 'open', [this.path]);
};

DictPGPlugin.prototype.query = function(query, params, handler) {
	PhoneGap.exec(function (data) {
		handler(null, data);
	}, function (err) {
		handler(err || 'Phonegap error');
	}, 'Dict', 'query', [query, params]);
};