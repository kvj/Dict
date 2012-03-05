var dict = null;
var manager = null;
var layout = null;
var config = null;
var kanjiXML = [];
var syncManager = null;
var db = null;

yepnope({
    load: ['lib/custom-web/cross-utils.js', 'lib/common-web/jquery-1.7.1.min.js', 'lib/common-web/underscore-min.js', 'lib/common-web/underscore.strings.js', 'lib/common-web/json2.js', 'lib/custom-web/layout.js', 'lib/ui/ui.css', 'lib/ui/theme-default.css', 'lib/ui/ui.js', 'lima1/net.js', 'lima1/main.js', 'lib/custom-web/date.js'],
    complete: function () {
        yepnope([{
            load: ['lib/common-web/jquery.autogrow.js', 'lib/common-web/jquery.mousewheel.js']
        }, {
            test: CURRENT_PLATFORM == PLATFORM_AIR,
            yep: ['lib/air/AIRAliases.js', 'lib/air/AIRIntrospector.js']
        }, {
            test: CURRENT_PLATFORM_MOBILE,
            yep: ['lib/ui/android.css', 'lib/common-web/phonegap-1.4.1.js', 'dict/dict-pg-plugin.js'],
            nope: ['lib/ui/desktop.css']
        }, {
            load: ['dict/dict-sheet.js', 'dict/canto-0.13.js', 'dict/dict.css'],
            complete: function () {
                $(function() {//Ready
                    if (CURRENT_PLATFORM_MOBILE) {//deviceready listener
                        log('Running phonegap...');
                        run();
                    } else {
                        log('Desktop start...');
                        run();
                    };
                });
            }
        }]);
    }
})


var run = function() {
    if (CURRENT_PLATFORM == PLATFORM_AIR) {
        db = new AirDBProvider('dict', '1');
    } else {
        db = new HTML5Provider('dict', '1');
    }
    _initUI(db);
    if (CURRENT_PLATFORM_MOBILE) {//Empty layout
        layout = new Layout({});
    } else {//Simple layout
        layout = new Layout({id: 'main'});
    };
    manager = new PanelManager({
        root: $('#main'),
        minColWidth: 400
    });
    $('<div id="sync_indicator"/>').appendTo($('#main')).hide();
    if (CURRENT_PLATFORM_MOBILE) {
        dict = new DictPGPlugin('dict/dict.sqlite');
    } else {
        dict = new AirDBProvider('dict/dict.sqlite');
    }
    if (CURRENT_PLATFORM == PLATFORM_AIR) {//
        window.nativeWindow.addEventListener(air.Event.CLOSE, function() {
            air.NativeApplication.nativeApplication.exit();
        });
    };
    dict.open(false, function(err) {//DB OK
        log('Dict ok', err);
        if (err) {
            return _defaultDBError(err);
        };
        for (var i = 0; i < 5; i++) {//Run ajax
            $.ajax({
                url: 'dict/kanji'+i+'.xml',
                dataType: 'xml',
                success: function(data) {//XML done
                    _showInfo('Kanji loaded');
                    //log('Kanji loaded', data);
                    kanjiXML.push(data);
                },
                error: function(err, st) {
                    log('Kanji not loaded: '+err, st);
                    _showInfo('Kanji load error');
                },
            });
        };
        // dict.on_start = function() {//Show loading action
        //     manager.element.stop().clearQueue().fadeTo(100, 0.8);
        //     return manager;
        // };
        // dict.on_end = function(object) {//Hide loading action
        //     if (object && object.element) {//remove class
        //         object.element.stop().clearQueue().fadeTo(100, 1);
        //     };
        // }
        var tp = new TopPanel();
        // config = new DBConfig({
        //     goBack: true,
        //     appConfig: {
        //         sync_url: {label: 'Sync URL:'},
        //         sync_key: {label: 'Sync key:', type: 'password'},
        //         //sync_delay: {label: 'Sync delay (sec):'},
        //     },
        //     api: true,
        // });
        // config.api.on('dict', _.bind(function(evt) {//Create translation
        //     var lines = _importText(evt.object? evt.object.text: '');
        //     if (lines.length == 0) {//Empty text
        //         evt.error = 'Text is empty'
        //     } else {//Show text viewer
        //         if (CURRENT_PLATFORM == PLATFORM_AIR) {//Activate window
        //             window.nativeWindow.activate();
        //             window.nativeWindow.orderToFront();
        //         };
        //         _showInfo('Lines imported: '+lines.length);
        //         var tv = new TextViewer({
        //             lines: lines,
        //             panel: tp.panel,
        //         });
        //     };
        // }, this));
        tp.open();
    }, true);
};

var _isHiragana = function(code) {//Verifies is code is hiragana
    if (code>=0x3040 && code<=0x309f) {//Hiragana
        return true;
    };
    return false;
};

var _isKanji = function(code) {//Verifies is code is hiragana
    if (code>=0x4e00 && code<=0x9faf) {//Hiragana
        return true;
    };
    return false;
};

var parseLine = function(line, on_ok) {//Parses line and translates all words
    var result = [];
    var nextWord = function(start) {//Searches next word in line
        //log('nextWord', start);
        var results = [];
        var nextChar = function(start, pos) {//Searches part of word in dictionary
            var word = line.substr(start, pos);
            //log('nextChar', start, pos, word);
            dict.query('select * from dict where kana=? or kanji=?', [word, word], function(err, data) {//query complete
                if (err) {
                    return;
                };
                if (data.length>0) {//Word found
                    results.push(data[0]);
                    //Search next char
                    nextChar(start, pos+1);
                } else {//No word found
                    if (results.length == 0) {//No subwords
                        result.push({word: word});
                    } else {//Some results found
                        result.push({word: line.substr(start, pos-1), dict: results[results.length-1]});
                        pos--;
                    };
                    nextWord(start+pos);
                };
            });
        }
        if (start>=line.length) {//Last word
            on_ok(result, line);
            return;
        };
        nextChar(start, 1);
    };
    nextWord(0);
};

var TopPanel = function() {//Top panel
    _createEsentials(this, 'Welcome:', 2);
    this.topMenu.addButton({
        caption: 'Sync',
        handler: _.bind(function() {//Show Dictionary
            this.sync();
        }, this)
    });
    this.topMenu.addButton({
        caption: 'Quick text',
        handler: _.bind(function() {//Show Dictionary
            var qt = new QuickText();
            manager.show(qt.panel, this.panel);
        }, this)
    });
    this.topMenu.addButton({
        caption: 'Dictionary',
        handler: _.bind(function() {//Show Dictionary
            var d = new Dictionary();
            manager.show(d.panel, this.panel);
        }, this)
    });
    this.topMenu.addButton({
        caption: 'Kanji panel',
        handler: _.bind(function(btns, btn, e) {//Show Dictionary
            //log('openKanjiPanel', e.ctrlKey);
            openKanjiPanel(this.panel, e.ctrlKey);
        }, this)
    });
    this.topMenu.addButton({
        caption: 'Lists',
        handler: _.bind(function() {//Show Dictionary
            if (syncManager) {
                new ListsManager(this.panel);
            };
        }, this)
    });
    this.textsButton = {
        caption: 'Texts',
        handler: _.bind(function() {//
            if (syncManager) {//
                var c = new Collections();
                manager.show(c.panel, this.panel);
            };
        }, this)
    };
    this.topMenu.addButton(this.textsButton);
    this.topMenu.addButton({
        caption: 'Config',
        handler: _.bind(function() {//Open DB config
            var items = [];
            if (syncManager) {//DB opened
                items.push({
                    caption: 'Load words',
                    handler: _.bind(function() {//Show tags
                        $.ajax({
                            url: 'dict/words.xml',
                            dataType: 'xml',
                            success: function(data) {
                                var nl = data.getElementsByTagName('word');
                                log('Words:'+nl.length);
                                var tags = {};
                                for (var i = 0; i < nl.length; i++) {
                                    var el = nl[i];
                                    var tag = el.getAttribute('tags');
                                    if (tag && !tags[tag]) {
                                        tags[tag] = true;
                                    };
                                };
                                tags = _.keys(tags);
                                var inserts = [];
                                for (var i = 0; i < tags.length; i++) {
                                    log('Tag', tags[i]);
                                    inserts.push({
                                        type: 'insert',
                                        table: 'lists',
                                        fields: ['name'],
                                        values: [tags[i]]
                                    });
                                };
                                syncManager.batch(inserts, function(data, err) {
                                    if (!data) {
                                        return _showError(err);
                                    };
                                    var tagIDs = {};
                                    for (var i = 0; i < tags.length; i++) {
                                        log('Found ID:', tags[i], data[i].lastID);
                                        tagIDs[tags[i]] = data[i].lastID;
                                    };
                                    inserts = [];
                                    for (var i = 0; i < nl.length; i++) {
                                        var el = nl[i];
                                        var tag = el.getAttribute('tags');
                                        if (tagIDs[tag]) {//Add word
                                            inserts.push({
                                                type: 'insert',
                                                table: 'words',
                                                fields: ['kanji', 'kana', 'trans', 'list_id'],
                                                values: [el.getAttribute('foreign'), el.getAttribute('trans'), el.getAttribute('native'), tagIDs[tag]]
                                            });
                                        };
                                    };
                                    log('Adding words', inserts.length);
                                    syncManager.batch(inserts, function(data, err) {
                                        if (!data) {
                                            return _showError(err);
                                        };
                                        log('Insert complete:', data.length);
                                    });
                                })
                            },
                        });
                        return true;
                    }, this),
                });
            };
            items.push({
                caption: 'App config',
                handler: _.bind(function() {
                    config.editAppConfig();
                    return true;
                }, this),
            });
            new PopupMenu({
                element: this.panel.element,
                items: items,
            });
        }, this)
    });
    manager.show(this.panel);
};

TopPanel.prototype.open = function() {
    syncManager = null;
    var storage = new StorageProvider(db)
    var jqnet = new jQueryTransport('http://lima1sync.appspot.com')
    var oauth = new OAuthProvider({
        clientID: 'dict'
    }, jqnet);
    oauth.on_token_error = _.bind(function () {
        this.login();
    }, this);
    syncManager = new Lima1DataManager('dict', oauth, storage)
    syncManager.sync_timeout = 60;
    syncManager.on_scheduled_sync = _.bind(function () {
        this.sync();
    }, this);
    syncManager.open(_.bind(function(err) {//local DB opened
        if (!err) {//
        } else {//Error
            _showInfo('Error opening DB: '+err);
        };
    }, this));
};

TopPanel.prototype.sync = function() {
    if (syncManager) {
        $('#sync_indicator').show();
        _showInfo('Sync started...', 15000);
        syncManager.sync(_.bind(function(err) {//Run sync
            $('#sync_indicator').hide();
            if (err) {//Error
                _showInfo('Error sync: '+err);
            } else {//Sync done
                $('#info_dialog').hide();
            };
        }, this));
    };
};

TopPanel.prototype.login = function () {
    var body = $(document.createElement('div'));
    var username = _addInput('Username:', 'text', body);
    var password = _addInput('Password:', 'password', body);
    var btns = _showQuestion('Enter username and password:', _.bind(function(index) {//Finished
        if (index == 1) {//Cancel
            return;
        };
        log('Login:', username.val(), password.val());
        syncManager.oauth.tokenByUsernamePassword(username.val(), password.val(), _.bind(function (err) {
            log('Auth result:', err);
            if(err) {
                _showError(err.error_description || err)
            };
            this.sync();
        }, this));
    }, this), [{caption: 'Ok'}, {caption: 'Cancel'}], body);
};

var KanjiDrawing = function() {//
    this.root = $('<div/>').addClass('drawing');
    this.buttons = new Buttons({
        root: this.root
    });
    this.trans = $('<div/>').addClass('drawing_trans').appendTo(this.root);
    this.drawing = $('<canvas/>').appendTo(this.root).addClass('drawing_pane').hide();
    this.canto = canto(this.drawing.get(0));
    this.drawing.bind('mousewheel', _.bind(function(e) {
        var direction = e.wheelDelta>0? -1: 1;
        if (e.ctrlKey) {
            direction *= -1;
        };
        KanjiDrawing.drawingSize += 10*direction;
        this.drawKanji(null, KanjiDrawing.drawingSize);
        return false;
    }, this))
};

KanjiDrawing.drawingSize = 300;//Default

KanjiDrawing.prototype.drawKanji = function(ji, size) {
    if (!ji) {
        ji = this.lastKanji;
    } else {
        this.lastKanji = ji;
    };
    if (!ji) {
        return;
    };
    var cols = [
        [0xff, 0xff, 0xff], [0xff, 0x00, 0x00], [0x00, 0x99, 0x00], 
        [0x00, 0x00, 0xff], [0xaa, 0xaa, 0xaa], [0x00, 0xcc, 0xcc], 
        [0xcc, 0x00, 0xcc], [0xff, 0xcc, 0x00]
    ];
    var toHex = function(num) {
        var res = num.toString(16);
        if(res.length == 1)
            res = '0'+res;
        return res;
    };
    this.drawing.show();
    this.canto.width = this.root.innerWidth();
    this.canto.height = size;
    var nl = ji.getElementsByTagName('p');
    this.canto.save().translate((this.root.innerWidth()-size)/2, 0).scale(size/109, size/109);
    for ( var i = 0; i < nl.length; i++) {
        var p = nl.item(i);
        var col = cols[parseInt(p.getAttribute('g')) % cols.length];
        var cs = '#'+toHex(col[0])+toHex(col[1])+toHex(col[2]);
        var lineWidth = 4-parseInt(p.getAttribute('s'));
        if (lineWidth<1)
            lineWidth = 1;
        this.canto.save();
        this.canto.beginPath().arc(parseFloat(p.getAttribute('cx')), parseFloat(p.getAttribute('cy')), lineWidth).stroke({strokeStyle: cs, lineWidth: 1}).endPath();
        this.canto.beginPath().svgpath(p.getAttribute('d') || '').stroke({lineWidth: lineWidth, lineCap: 'round', strokeStyle: cs}).endPath();
        this.canto.restore();
    }
    this.canto.restore();
};

KanjiDrawing.prototype.show = function(text) {//
    this.buttons.clear();
    this.drawing.hide();
    if (!text) {
        text = '';
    };
    this.trans.text('');
    for (var i = 0; i < text.length; i++) {//Add buttons
        var ch = text.charAt(i);
        this.buttons.addButton({
            caption: ch,
            kanji: ch,
            className: 'kanji_btn',
            handler: _.bind(function(btns, btn) {//Click
                if (kanjiXML) {
                    var items = $(kanjiXML).find('ji[kanji="'+btn.kanji+'"]');
                    if (items.size() > 0) {//Not found
                        var ji = items.get(0);
                        //log('Selected:', items.size(), ji);
                        var capts = [];
                        if (ji.getAttribute('on')) {//
                            capts.push(ji.getAttribute('on'));
                        };
                        if (ji.getAttribute('kun')) {//
                            capts.push(ji.getAttribute('kun'));
                        };
                        if (ji.getAttribute('trans')) {//
                            capts.push(ji.getAttribute('trans'));
                        };
                        if (ji == this.lastKanji) {//Hide
                            this.drawing.hide();
                            this.trans.text('');
                            this.lastKanji = null;
                        } else {//Show
                            this.trans.text(capts.join('/'));
                            this.drawKanji(ji, KanjiDrawing.drawingSize);
                        };
                        return;
                    };
                };
                this.drawing.hide();
                this.trans.text('');
                _showInfo('No kanji XML loaded');
                return;
            }, this)
        });
    };
};

var Dictionary = function(config) {//Dictionary
    this.config = config || {};
    this.panel = new Panel(this.config.title || 'Dictionary');
    this.topMenu = new Buttons({
        root: this.panel.element,
        maxElements: 1
    });
    this.topMenu.addButton({
        caption: 'Back',
        handler: _.bind(function() {//Go back
            manager.goBack(this.panel);
        }, this)
    });
    var w = $('<div/>').addClass('input_wrap').appendTo(this.panel.element);
    this.input = $('<input type="text"/>').appendTo(w);
    this.kanjis = new KanjiDrawing();
    this.kanjis.root.appendTo(this.panel.element);
    this.input.val(this.config.word || '');
    this.input.keypress({instance: this}, function(e) {//
        if (e.which == 13) {//Enter
            e.data.instance.submit();
        };
    });
    if (this.config.data) {//Show results
        this.kanjis.show(this.config.word);
        this.searchDone(this.config.data);
    } else {//Focus text field
        setTimeout(_.bind(function() {//Focus
            this.input.focus().select();
        }, this), 10);
    };
}

Dictionary.prototype.submit = function() {//Do search
    this.panel.element.find('.dict_entry').remove();
    this.word = _.trim(this.input.val());
    this.kanjis.show(this.word);
    if (this.word) {//Make search
        this.exactSearch = true;
        dict.query('select * from dict where kana=? or kanji=? order by kanji desc, kana', [this.word, this.word], _.bind(function (err, data) {
            if (err) {
                return _defaultDBError(err)
            };
            this.searchDone(data);
        }, this));
    };
};

var _entryToEntry = function(entry, word) {//Converts entry to html entry
    var prefix = '';
    for (var i = 0; i < entry.pairs.length; i++) {//
        if (i>0) {//Add delimiter
            prefix += '・';
        };
        var p = entry.pairs[i];
        prefix += p.kanji || '';
        if (p.kanji != p.kana && p.kana != word) {//Add kana
            prefix += ' 「'+p.kana+'」';
        };
    };
    var text = entry.entry;
    var result = $('<div/>');
    var reg = /\S(;|$)/;
    var subreg = /^\s*(\d+.)?\s*(.*)$/;
    var group = $('<div/>').addClass('entry_group').appendTo(result);
    var entryCount = 0;
    var groupCount = 0;
    do {//Split entry by reg
        var idx = text.search(reg);
        var e = null;
        if (idx == -1) {//Last entry
            e = text;
            text = null;
        } else {//Found entry
            e = '';
            var m = text.substr(0, idx+1).match(subreg);
            //for (var i = 0; i < m.length; i++) {
                //log('m', i, m[i]);
            //};
            if (m[1]) {//Add number
                if (groupCount>0) {//Create new group
                    group = $('<div/>').addClass('entry_group').appendTo(result);
                };
                groupCount++;
                e += _.trim(m[1])+' ';
                entryCount = 0;
            };
            e += _.trim(m[2]);
            //log('Entry', e, text.search(reg), execResult, execResult.length, execResult[0]);
            //for (var i = 0; i < execResult.length; i++) {
                //log('execResult', i, execResult[i]);
            //};
            text = text.substr(idx+2);
        };
        if (e) {
            if (prefix) {//Prepend prefix
                e = prefix + e;
                prefix = null;
            };
            var div = $('<div/>').addClass('entry_line').appendTo(group);
            if (entryCount == 0) {//First entry in group
                div.addClass('entry_line_first');
            };
            entryCount++;
            div.text(e);
        };
    } while (text);
    return result;
};

Dictionary.prototype.searchDone = function(data) {//Search done
    //log('Found results:', data.length);
    for (var i = 0; i < data.length; i++) {//Check duplicates
        var e = data[i];
        e.pairs = [];
        var entryFound = false;
        //log('Entry:', i, e.kana, e.kanji, e.entry);
        for (var j = 0; j < i; j++) {//Check entries before
            if (data[j].entry == e.entry) {//Text is same
                //log('Found same with', j);
                entryFound = true;
                var found = false;
                for (var k = 0; k < data[j].pairs.length; k++) {//Check pairs
                    if (data[j].pairs[k].kana == e.kana && data[j].pairs[k].kanji == e.kanji) {//Found full duplicate
                        //log('Pair is same');
                        found = true;
                        break;
                    };
                };
                if (!found) {//Add pair
                    //log('Pair is different');
                    data[j].pairs.push({kana: e.kana, kanji: e.kanji});
                };
                break;
            };
        };
        if (!entryFound) {//Add first pair
            //log('Add first pair');
            e.pairs.push({kana: e.kana, kanji: e.kanji});
        };
    };
    for (var i = 0; i < data.length; i++) {//Add entries
        //log('print', i, data[i].pairs.length);
        if (data[i].pairs.length == 0) {//Pairs are empty - skip
            continue;
        };
        var entry = $('<div>').addClass('dict_entry').appendTo(this.panel.element);
        entry.append(_entryToEntry(data[i], this.word));
        entry.bind('click', {entry: data[i]}, _.bind(function(e) {//
            if (e.ctrlKey) {
                log('Adding word to list');
                _selectListToAddWord(this.panel, _.bind(function(id) {
                    new NewWordEditor(this.panel, id, {kanji: e.data.entry.kanji, kana: e.data.entry.kana, trans: _extractDefinition(e.data.entry.entry)}, true);
                }, this));
                return false;
            };
            if(this.config.entryHandler && this.config.entryHandler(e.data.entry)) {
                manager.goBack(this.panel);
            }
            return false;
        }, this));
    };
    if (this.exactSearch && data.length == 0) {//Look for substring
        this.exactSearch = false;
        dict.query('select * from dict where kana like ? or kanji like ? order by kanji desc, kana', ['%'+this.word+'%', '%'+this.word+'%'], _.bind(function (err, data) {
            if (err) {
                return _defaultDBError(err);
            };
            this.searchDone(data);
        }, this));
    };
};

var _importText = function(text) {//Imports text, returns array of lines
    if (!text) {//No text
        text = '';
    };
    var delims = [/[\r\n]*\n[\r\n]*/, /\.\s+/, /\.{3}\s+/, /\?\s+/, /\!\s+/, /\u3002+[\u3000\u3009\u300b\u300d\u300f\s]*/, /\u3002{3}[\u3000\u3009\u300b\u300d\u300f\s]*/, /\uff01+[\u3000\u3009\u300b\u300d\u300f\s]*/, /\uff1f+[\u3000\u3009\u300b\u300d\u300f\s]*/];
    var lines = [];
    do {
        var n = -1;
        var di = -1;
        for (var i = 0; i < delims.length; i++) {//Search for delimiter
            var pos = text.search(delims[i]);
            if ((pos<=n || n == -1) && pos != -1) {//Save
                di = i;
                n = pos;
            };
        };
        if (n == -1) {//Last line
            break;
        };
        var len = delims[di].exec(text)[0].length;
        lines.push(_.trim(text.substr(0, n+len)));
        text = text.substr(n+len);
    } while(true);
    if (text) {//Add last line
        lines.push(_.trim(text));
    };
    for (var i = 0; i < lines.length; i++) {//Check every line is not just delimiter
        if (!lines[i]) {//Remove empty line
            lines.splice(i, 1);
            i--;
            continue;
        };
        for (var j = 0; j < delims.length; j++) {
            if (lines[i] == delims[j].exec(lines[i])) {//Remove such line
                lines.splice(i, 1);
                i--;
                break;
            };
        };
    };
    return lines;
};

var QuickText = function() {//Quick text page. Back, textarea, Go
    this.panel = new Panel('Quick text');
    this.topMenu = new Buttons({
        root: this.panel.element,
        maxElements: 2
    });
    this.topMenu.addButton({
        caption: 'Back',
        handler: _.bind(function() {//Go back
            manager.goBack(this.panel);
        }, this)
    });
    this.topMenu.addButton({
        caption: 'Go',
        handler: _.bind(function() {//Go
            var lines = _importText(this.input.val());
            if (lines.length == 0) {//Empty text
                _showError('Text is empty');
            } else {//Show text viewer
                _showInfo('Lines imported: '+lines.length);
                var tv = new TextViewer({
                    lines: lines,
                    panel: this.panel,
                });
            };
        }, this)
    });
    var w = $('<div/>').addClass('area_wrap').appendTo(this.panel.element);
    this.input = $('<textarea/>').appendTo(w);
    this.input.autoGrow(15);
    setTimeout(_.bind(function() {//Focus
        this.input.focus();
    }, this), 10);
};

var _selectListToAddWord = function(panel, handler) {
    syncManager.storage.select('lists', ['listed', 1], _.bind(function (err, data) {
        if (err) {
            return _defaultDBError(err);
        };
        var items = [];
        for (var i = 0; i < data.length; i++) {
            items.push({
                caption: data[i].name,
                id: data[i].id,
                handler: function(item) {//
                    handler(item.id);
                    return true;
                },
            });
        };
        new PopupMenu({
            element: panel.element,
            items: items
        });
    }, this), {order: ['name']})
};

var TextViewer = function(config) {//Show japanese text with menu and other functions
    this.config = config;
    this.panel = new Panel(this.config.title || 'Untitled');
    this.topMenu = new Buttons({
        root: this.panel.element,
        maxElements: 2
    });
    this.topMenu.addButton({
        caption: 'Back',
        handler: _.bind(function() {//Go back
            manager.goBack(this.panel);
        }, this)
    });
    manager.show(this.panel, config.panel);
    this.menu = $('<div/>').addClass('menu').appendTo(this.panel.element);
    this.entry = $('<div/>').addClass('menu').appendTo(this.panel.element);
    this.trans = $('<div/>').addClass('trans').appendTo(this.menu);
    this.menuButtons = new Buttons({
        root: this.menu
    });
    this.menuButtons.addButton({
        caption: 'Remove',
        handler: _.bind(function() {//
            this.hideMenus();
            if (this.word) {//Have word selected
                //this.word.find('.char').insertBefore(this.word);
                //this.word.remove();
                var words = this.words[this.selected];
                for (var i = 0; i < words.length; i++) {
                    if (words[i] == this.word) {
                        words.splice(i, 1);
                        break;
                    };
                };
                this.word = null;
                this.trans.text('No word selected');
                this.entry.empty();
                this.drawLine(this.selected, true);
            };
        }, this)
    });
    this.menuButtons.addButton({
        caption: 'Others',
        handler: _.bind(function() {
            this.hideMenus();
            if (this.word) {//Have word selected
                var results = this.word.data.allresults || [];
                var items = [];
                for (var i = 0; i < results.length; i++) {//Build popup
                    var res = results[i];
                    if (!res.dict) {//Skip
                        continue;
                    };
                    var needAdd = true;
                    for (var j = 0; j < items.length; j++) {//Check item was added before
                        if (items[j].word == res.word) {//Skip
                            needAdd = false;
                            break;
                        };
                    };
                    if (!needAdd) {//Skip
                        break;
                    };
                    items.push({caption: res.word+' '+_extractDefinition(res.dict.entry), index: i});
                };
                if (items.length == 0) {//No items
                    _showInfo('No variants');
                    return false;
                };
                this.variantsPopup = new PopupMenu({
                    panel: this.panel,
                    items: items,
                    handler: _.bind(function(item, index) {//Click on popup
                        this.showWord(results[item.index], results);
                        return true;
                    }, this)
                });
            };
        }, this)
    });
    this.menuButtons.addButton({
        caption: 'More',
        handler: _.bind(function() {//
            this.hideMenus();
            if (this.word) {//Have word selected
                var d = new Dictionary({
                    data: this.word.data.results,
                    word: this.word.data.word,
                    title: 'Other results:',
                    entryHandler: _.bind(function(entry) {//
                        var obj = this.word.data.original;
                        obj.dict = entry;
                        this.showWord(obj, this.word.data.allresults);
                        //var t = _extractDefinition(entry.entry);
                        //this.word.data('trans', t);
                        //this.trans.text(t);
                        //if (this.word.find('.word_trans').text()) {//Update in word text also
                            //this.word.find('.word_trans').text(t);
                        //};
                        return CURRENT_PLATFORM_MOBILE? true: false;
                    }, this)
                });
                manager.show(d.panel, this.panel);
            };
        }, this)
    });
    this.menuButtons.addButton({
        caption: 'Add...',
        handler: _.bind(function() {//
            this.hideMenus();
            if (this.word) {//Have word selected
                _selectListToAddWord(this.panel, _.bind(function(id) {
                    new NewWordEditor(this.panel, id, {kanji: this.word.data.word, kana: this.word.data.kana, trans: this.word.data.trans}, true);
                }, this));
            };
        }, this)
    });
    this.kanjis = new KanjiDrawing();
    this.kanjis.root.appendTo(this.menu);
    this.lines = [];
    this.text = [];
    this.selected = -1;
    this.kanjiSize = 20;
    this.kanaSize = 12;
    this.words = [];
    this.scale = 1;
    this.selectedScale = 1.3;
    this.canvases = [];
    this.kanjiCache = {};
    this.items = [];
    for (var i = 0; i < this.config.lines.length; i++) {//Add lines
        this.addLine(this.config.lines[i]);
    };
    if (this.config.id && this.config.chapters) {//Add mark as read & remove
        this.bottomMenu = new Buttons({
            root: this.panel.element,
            maxElements: 2
        });
        this.bottomMenu.addButton({
            caption: 'Read & Next',
            handler: _.bind(function() {//Update current
                syncManager.findOne('chapters', this.config.id, _.bind(function (err, obj) {
                    if (err) {
                        return _defaultDBError(err);
                    };
                    obj.read = new Date().getTime();
                    syncManager._save('chapters', obj, _.bind(function (err) {
                        if (err) {
                            return _defaultDBError(err);
                        };
                        manager.goBack(this.panel);
                    }, this))
                }, this));
            }, this)
        });
        this.bottomMenu.addButton({
            caption: 'Remove',
            handler: _.bind(function() {//Update current
                syncManager.findOne('chapters', this.config.id, _.bind(function (err, obj) {
                    if (err) {
                        return _defaultDBError(err);
                    };
                    obj.read = new Date().getTime();
                    syncManager.storage.remove('chapters', obj, _.bind(function (err) {
                        if (err) {
                            return _defaultDBError(err);
                        };
                        manager.goBack(this.panel);
                    }, this))
                }, this));
            }, this)
        });
    };
    this.magnifier = $('<div/>').addClass('magnifier').appendTo(this.panel.element).hide();
    this.selectLine(this.config.index || 0);
};

TextViewer.prototype.hideMenus = function() {//Hides all opened menus
    if (this.variantsPopup) {
        this.variantsPopup.hide();
    };
};

TextViewer.prototype.drawLine = function(index, selected) {//
    var scale = this.scale*(selected? this.selectedScale: 1);
    var line = this.text[index];
    var ctx = this.canvases[index];
    var lineWidth = this.panel.element.innerWidth();
    ctx.width = this.panel.element.innerWidth();
    var items = [];
    var words = this.words[index];
    var x = 0;
    var y = 0;
    var itemHeight = (this.kanjiSize+this.kanaSize)*scale;
    for (var i = 0; i < line.length;) {//Build items to show
        var item = {kanji: line.charAt(i), kana: ''};
        for (var j = 0; j < words.length; j++) {
            if (words[j].start == i) {//Start of word
                item = {kanji: line.substr(i, words[j].len), kana: words[j].kana, word: words[j], selected: words[j] == this.word};
                break;
            };
        };
        var itemWidth = Math.max(item.kanji.length*this.kanjiSize, item.kana.length*this.kanaSize)*scale;
        if (itemWidth+x>lineWidth) {//Next line
            x = 0;
            y += itemHeight;
        };
        item.x = x;
        item.y = y;
        item.width = itemWidth;
        item.height = itemHeight;
        x += itemWidth;
        item.index = i;
        i += item.kanji.length;
        //log('drawLine', i, item.x, item.y, item.width, lineWidth);
        items.push(item);
    };
    ctx.height = y+itemHeight;
    //log('drawLine', ctx.height, items.length);
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        ctx.save();
        ctx.translate(item.x, item.y);
        if (item.word) {//bg
            ctx.fillRect(0, 0, item.width, itemHeight, {fillStyle: '#222222'});
        };
        this.drawText(ctx, item.kana, item.width, this.kanaSize*scale, item.selected);
        ctx.translate(0, this.kanaSize*scale);
        this.drawText(ctx, item.kanji, item.width, this.kanjiSize*scale, item.selected);
        ctx.restore();
    };
    this.items[index] = items;
};

TextViewer.prototype.drawText = function(ctx, text, width, charSize, selected) {//Draws one kanji
    var col = selected? '#ffffff': '#efefef';
    for (var i = 0; i < text.length; i++) {//Draw chars one by one
        ctx.save();
        ctx.translate((width-text.length*charSize)/2+i*charSize, 0).scale(charSize/109, charSize/109);
        var ch = text.charAt(i);
        var el = this.kanjiCache[ch];
        if (!el) {
            el = ch;
            if (kanjiXML) {
                for (var j = 0; j < kanjiXML.length; j++) {//
                    var items = $(kanjiXML[j]).find('ji[kanji="'+ch+'"]');
                    if (items.size() > 0) {//Not found
                        el = items.get(0);
                        break;
                    };
                };
            };
            this.kanjiCache[ch] = el;
        };
        if (el.getElementsByTagName) {//
            var nl = el.getElementsByTagName('p');
            for ( var j = 0; j < nl.length; j++) {
                var p = nl.item(j);
                var gr = parseInt(p.getAttribute('g'));
                ctx.save().beginPath().svgpath(p.getAttribute('d')).stroke({lineWidth: 6, lineCap: 'round', strokeStyle: col}).endPath().restore();
            }
        } else {//Char - draw text
            ctx.fillText(el, 0, 95, 109, {fillStyle: col, font: '109px Arial', strokeStyle: col});
        };
        ctx.restore();
    };
};

TextViewer.prototype.addLine = function(line) {//Adds one line to panel
    var canvas = $('<canvas/>').addClass('line_canvas').appendTo(this.panel.element);
    var place = $('<div/>').addClass('line').appendTo(this.panel.element);
    //var arr = [];
    //for (var i = 0; i < line.length; i++) {//Print line
        ////log('char', line.charAt(i), line.charCodeAt(i).toString(16));
        //var code = line.charCodeAt(i);
        //var ch = $('<span/>').addClass('char').appendTo(place).text(line.charAt(i));
        //arr.push(ch);
        //if (_isHiragana(code)) {//Hiragana
            //ch.addClass('kana');
        //} else {
            //if (_isKanji(code)) {//Kanji
                //ch.addClass('kana kanji');
            //} else {//Stop
                //continue;
            //};
        //};
        //ch.data('index', i);
        //var eventObject = {instance: this, line: this.lines.length};
        //ch.bind(CURRENT_EVENT_DOWN, eventObject, function(e) {//Click on char
            //e.data.instance.hideMenus();
            //if (e.data.instance.selected != e.data.line) {//Bypass click
                //return true;
            //};
            //e.data.instance.magnifier.show();
            //e.data.instance.moveMagnifier($(this));
            //return false;
        //});
        //ch.bind(CURRENT_EVENT_MOVE, eventObject, function(e) {//Click on char
            //if (e.data.instance.selected != e.data.line) {//Bypass click
                //return true;
            //};
            //var ch = e.data.instance.findCharUnder(e, this);
            //if (ch) {//Move magnifier
                //e.data.instance.moveMagnifier($(ch));
            //};
            //return false;
        //});
        //ch.bind(CURRENT_EVENT_UP, eventObject, function(e) {//Click on char
            //e.data.instance.hideMenus();
            //if (e.data.instance.selected != e.data.line) {//Bypass click
                //return true;
            //};
            //e.data.instance.magnifier.hide();
            //var ch = e.data.instance.findCharUnder(e, this);
            //if (!ch) {
                //return false;
            //};
            //if ($(ch).parents('.word').size()>0) {//Click on word
                //e.data.instance.wordClick($(ch).parents('.word'));
            //} else {//Translate
                //e.data.instance.textClick($(ch).data('index'));
            //};
            //return false;
        //});
    //}
    //$('<div style="clear: both;"/>').appendTo(place);
    //place.bind('click', {instance: this, index: this.lines.length}, function(e) {//Click on line
        //e.data.instance.selectLine(e.data.index);
        //e.preventDefault();
        //e.stopImmediatePropagation();
        //return false;
    //});
    var index = this.text.length;
    //this.lines.push(arr);
    this.text.push(line);
    this.words.push([]);
    var ctx = canto(canvas.get(0));
    this.canvases.push(ctx);
    this.drawLine(index, false);
    canvas.bind('click', _.bind(function(e) {//Yea
        if (index != this.selected) {
            this.selectLine(index);
        } else {//Click on char
            var coords = getEventCoordinates(e);
            var items = this.items[index];
            var x = coords.x - canvas.offset().left;
            var y = coords.y - canvas.offset().top;
            //log('x', x, 'y', y);
            for (var i = 0; i < items.length; i++) {//Search for item
                var item = items[i];
                //log(x, y, item.x, item.y, item.width, item.height);
                if (x>=item.x && x<=item.x+item.width && y>=item.y && y<=item.y+item.height) {//Found
                    var idx = item.index+Math.floor((x-item.x)*item.kanji.length/item.width);
                    //log('Click on', idx);
                    if (item.word && item.word != this.word) {//Select word
                        this.wordClick(item.word);
                    } else {//Re-search word under cursor
                        this.textClick(idx);
                    };
                };
            };
        };
        return false;
    }, this));
};

TextViewer.prototype.findCharUnder = function(e, ch) {
    var place = $(ch).parents('.line');
    var result = null;
    var c = getEventCoordinates(e);
    place.find('.kana').each(function() {//Search for char
        var pos = $(this).offset();
        if (c.x>=pos.left && c.y>=pos.top && c.x<pos.left+$(this).outerWidth() && c.y<pos.top+$(this).outerHeight()) {//Found char
            result = this;
            return false;
        };
    });
    return result;
};

TextViewer.prototype.moveMagnifier = function(ch) {//Shows magnifier for char
    this.magnifier.text(ch.text());
    var chOffest = ch.offset();
    var panelOffest = this.panel.element.offset();
    var panelWidth = this.panel.element.outerWidth();
    var mX = chOffest.left - panelOffest.left;//Left angle of ch
    mX += Math.floor((ch.outerWidth()-this.magnifier.outerWidth()) / 2);
    if (mX+this.magnifier.outerWidth()>panelWidth) {//Fix x
        mX = panelWidth-this.magnifier.outerWidth();
    };
    if (mX<0) {//Fix x
        mX = 0;
    };
    var mY = chOffest.top - panelOffest.top - this.magnifier.outerHeight()-10;
    this.magnifier.css('left', mX).css('top', mY);
};

TextViewer.prototype.selectLine = function(index) {//Selects line
    this.hideMenus();
    if (this.selected == index) {//Already selected
        return false;
    };
    if (this.selected != -1) {
        this.drawLine(this.selected, false);
    };
    this.selected = index;
    this.drawLine(this.selected, true);
    //this.panel.element.children('.line').removeClass('line_selected');
    var line = this.panel.element.children('.line_canvas').eq(index);
    //line.addClass('line_selected');
    //line.find('.word').removeClass('word_selected');
    this.entry.insertAfter(line);
    this.menu.insertAfter(line);
    this.trans.text('No word selected');
    this.kanjis.show();
    this.entry.empty();
    this.word = null;
    return true;
};

TextViewer.prototype.markChars = function(start, len, kana, data) {//Wraps chars and shows kana
    var words = this.words[this.selected];
    for (var i = 0; i < words.length; i++) {//Remove all intersections
        var w = words[i];
        var remove = false;
        if (start>=w.start && start<w.start+w.len) {//
            remove = true;
        };
        if (start+len>w.start && start<=w.start) {//
            remove = true;
        };
        if (remove) {
            words.splice(i, 1);
            i--;
        };
    };
    var w = {start: start, len: len, kana: kana, data: data};
    words.push(w);
    //Remove all wraps from selected chars
    //for (var i = 0; i < len; i++) {
        //if (start+i>=this.lines[this.selected].length) {//Line is over
            //break;
        //};
        //var w = this.lines[this.selected][start+i].parents('.word');
        //w.find('.char').detach().insertBefore(w);
        //w.remove();
    //};
    //var w = $('<span/>').addClass('word').insertBefore(this.lines[this.selected][start]);
    //w.data(data);
    //var chars = $('<span/>').addClass('chars').appendTo(w);
    //for (var i = 0; i < len; i++) {
        //if (start+i>=this.lines[this.selected].length) {//Line is over
            //break;
        //};
        //this.lines[this.selected][start+i].appendTo(chars);
    //};
    //if (kana) {//Add kana
        //var k = $('<span/>').addClass('kana_up').appendTo(w).text('「'+kana+'」');
        //k.bind(CURRENT_EVENT_DOWN, {instance: this, word: w}, function(e) {//Click on word
            //if (e.data.word.data('line') != e.data.instance.selected) {//Other line is selected
                //return true;
            //};
            //e.data.instance.wordClick(e.data.word);
            //return false;
        //});
    //};
    //var trans = $('<span/>').addClass('word_trans').appendTo(w);
    this.wordClick(w);
};

var _extractDefinition = function(entry) {//Extracts short definition
    var start = 0;
    var reg = /\S(;|$)/;
    var subreg = /^\s*(\d+.)?\s*(.*)$/;
    var idx = entry.search(reg);
    if (idx == -1) {//Invalid entry
        return null;
    };
    var m = entry.substr(0, idx+1).match(subreg);
    return m[2];
};

TextViewer.prototype.textClick = function(index) {//
    var line = this.text[this.selected];
    //log('Click on', line.charAt(index));
    var leftChars = [];
    for (var i = 1; i < 3; i++) {//Save two chars to the left
        if (index-i<0) {//Beggining of line - break;
            break;
        };
        if (!_isKanji(line.charCodeAt(index-i)) && !_isHiragana(line.charCodeAt(index-i))) {//Not a kanji or hiragana
            break;
        };
        leftChars.push(line.charAt(index-i));
    };
    var rightChars = [];
    for (var i = 0; i < 4; i++) {//Save three chars to the right
        if (index+i>=line.length) {//End of line - break;
            break;
        };
        if (!_isKanji(line.charCodeAt(index+i)) && !_isHiragana(line.charCodeAt(index+i))) {//Not a kanji or hiragana
            break;
        };
        rightChars.push(line.charAt(index+i));
    };
    var texts = [];
    var _addTextVariant = function(variant) {//Avoids duplicates in text
        for (var idx = 0; idx < texts.length; idx++) {//Check was added before
            if (texts[idx].word == variant.word) {//Skip
                return false;
            };
        };
        texts.push(variant);
        return true;
    };
    for (var i = 0; i <= leftChars.length; i++) {//Left
        for (var j = 1; j <= rightChars.length; j++) {//Right
            var text = '';
            for (var k = 0; k < i; k++) {//Copy chars from left
                text = leftChars[k]+text;
            };
            for (var k = 0; k < j; k++) {//Copy right chars
                text += rightChars[k];
            };
            _addTextVariant({word: text, start: index-i, original: text});
            //i adj. negative
            var subs = [
                {ends: 'く', replace: ['い']},//ku - i
                {ends: 'か', replace: ['い']},//ka - i
                {ends: 'な', replace: ['る']},//na - ru
                {ends: 'さ', replace: ['す']},//sa = su
                {ends: 'か', replace: ['く']},
                {ends: 'が', replace: ['ぐ']},
                {ends: 'ば', replace: ['ぶ']},
                {ends: 'た', replace: ['つ']},
                {ends: 'ま', replace: ['む']},
                {ends: 'ら', replace: ['る']},
                {ends: 'わ', replace: ['う']},
                {ends: 'な', replace: ['ぬ']},
                {ends: 'た', replace: ['る']},//ta - ru
                {ends: 'した', replace: ['す']},//shita - su
                {ends: 'いた', replace: ['く', 'ぐ']},//ita - ku, gu
                {ends: 'んだ', replace: ['む', 'ぶ', 'ぬ']},//nda - mu, bu, nu
                {ends: 'った', replace: ['る', 'う', 'つ']},//tta - ru, u, tsu
                {ends: 'ま', replace: ['る']},//ma - ru
                {ends: 'き', replace: ['く']},//ki - ku
                {ends: 'ぎ', replace: ['ぐ']},
                {ends: 'し', replace: ['す']},
                {ends: 'び', replace: ['ぶ']},
                {ends: 'ち', replace: ['つ']},
                {ends: 'み', replace: ['む']},
                {ends: 'り', replace: ['る']},
                {ends: 'い', replace: ['う']},
                {ends: 'に', replace: ['ぬ']},
                {ends: 'て', replace: ['る']},//te - ru
                {ends: 'して', replace: ['す']},//shite - su
                {ends: 'いて', replace: ['く', 'ぐ']},//ite - ku, gu
                {ends: 'んで', replace: ['む', 'ぶ', 'ぬ']},//nde - mu, bu, nu
                {ends: 'って', replace: ['る', 'う', 'つ']},//tte - ru, u, tsu
                {ends: 'られ', replace: ['る']},//rare - ru
                {ends: 'せ', replace: ['す']},//se = su
                {ends: 'け', replace: ['く']},
                {ends: 'げ', replace: ['ぐ']},
                {ends: 'べ', replace: ['ぶ']},
                {ends: 'て', replace: ['つ']},
                {ends: 'め', replace: ['む']},
                {ends: 'れ', replace: ['る']},
                {ends: 'え', replace: ['う']},
                {ends: 'ね', replace: ['ぬ']},
                {ends: 'さ', replace: ['る']},//sa - ru
                {ends: 'よう', replace: ['る']},//you - ru
                {ends: 'そう', replace: ['す']},//sou = su
                {ends: 'こう', replace: ['く']},
                {ends: 'ごう', replace: ['ぐ']},
                {ends: 'ぼう', replace: ['ぶ']},
                {ends: 'とう', replace: ['つ']},
                {ends: 'もう', replace: ['む']},
                {ends: 'ろう', replace: ['る']},
                {ends: 'おう', replace: ['う']},
                {ends: 'のう', replace: ['ぬ']},
                //{ends: '', replace: ['']},
                //{ends: '', replace: ['']},
            ];
            for (var k = 0; k < subs.length; k++) {//Fix words
                var s = subs[k];
                if (_.endsWith(text, s.ends)) {//ends
                    for (var l = 0; l < s.replace.length; l++) {//Add words
                        _addTextVariant({word: text.substr(0, text.length-s.ends.length)+s.replace[l], start: index-i, length: text.length-s.ends.length, original: text});
                    };

                };
            };
        };
    };
    var gr = new AsyncGrouper(texts.length, _.bind(function(gr) {//All queries are done
        var best = -1;
        var l = 0;
        var bestdata = null;
        //log('Got results:', gr.results.length);
        for (var i = 0; i < gr.results.length; i++) {//For every SQL result find origin
            // log('for', i, gr.statuses[i], gr.results[i][0].length);
            if (!gr.statuses[i]) {//Query failed
                continue;
            };
            if (gr.results[i][0].length == 0) {//Not found
                continue;
            };
            var data = gr.results[i][0][0];
            // log('Found:', data.kana, data.kanji);
            for (var j = 0; j < texts.length; j++) {//Search for word for this result
                if (texts[j].word == data.kana || texts[j].word == data.kanji) {//Found word
                    //log('Orig:', texts[j].word, l);
                    texts[j].dict = data;
                    texts[j].results = gr.results[i][0];
                    if (texts[j].word.length>l) {//Best result
                        best = j;
                        l = texts[j].word.length;
                    };
                };
            };
        };
        if (best != -1) {//Found result
            this.showWord(texts[best], texts);
            //log('Trans:', best.word, best.dict.kana, best.dict.entry);
            //var data = {
                //trans: _extractDefinition(best.dict.entry),
                //word: best.word,
                //results: bestdata
            //};
            //this.markChars(best.start, best.length>0? best.length: best.word.length, best.dict.kana != best.original? best.dict.kana: '', data);
        } else {//Not found
            _showInfo('Translation not found');
        };
    }, this));
    for (var i = 0; i < texts.length; i++) {//Print words
        //log('Candidate:', texts[i].word, texts[i].start);
        dict.query('select * from dict where kana=? or kanji=? order by kanji desc, kana', [texts[i].word, texts[i].word], gr.fn);
    };
};

TextViewer.prototype.showWord = function(obj, allresults) {//Shows word
    var data = {
        trans: _extractDefinition(obj.dict.entry),
        word: obj.word,
        kana: obj.dict.kana,
        results: obj.results,
        original:obj,
        line: this.selected,
        allresults: allresults
    };
    this.markChars(obj.start, obj.length>0? obj.length: obj.word.length, obj.dict.kana != obj.original? obj.dict.kana: '', data);
    //this.drawLine(this.selected, true);
};

TextViewer.prototype.wordClick = function(word) {//Click on word - show menu
    //log('wordClick', word.data('word'));
    this.hideMenus();
    this.trans.text(word.data.trans);
    this.kanjis.show(word.data.word);
    this.entry.empty().append(_entryToEntry({pairs: [], entry: word.data.original.dict.entry}));
    //if (this.word && (this.word.data('word') == word.data('word'))) {//toggle trans
        ////log('Second click', word.find('.word_trans').text());
        //if (word.find('.word_trans').text()) {//Have text
            //word.find('.word_trans').empty();
        //} else {//Put text
            //word.find('.word_trans').text(word.data('trans'));
        //};
    //};
    this.word = word;
    //word.siblings('.word').removeClass('word_selected');
    //word.addClass('word_selected');
    this.drawLine(this.selected, true);
};

var Collections = function() {//Manages collection
    _createEsentials(this, 'Collections', 3);
    _goBackFactory(this.topMenu, this.panel);
    this.topMenu.addButton({
        caption: 'Add new',
        handler: _.bind(function() {//
            this.editDialog({});
        }, this)
    });
    this.lines = new Buttons({
        root: this.panel.element,
        maxElements: 1
    });
    this.panel.onSwitch = _.bind(function() {
        syncManager.storage.select('collections', [], _.bind(function (err, data) {
            if (err) {
                return _defaultDBError(err);
            };
            this.lines.clear();
            for (var i = 0; i < data.length; i++) {//Create button
                this.lines.addButton({
                    caption: data[i].name || 'Untitled',
                    safe: true,
                    data: data[i],
                    className: 'button_left',
                    classNameInner: 'button_list',
                    handler: _.bind(function(e, btn) {//
                        //log('Edit', btn.data.name);
                        //this.editDialog(btn.data);
                        this.showCollection(btn.data);
                    }, this)
                });
            };
        }, this));
    }, this);
};

Collections.prototype.editDialog = function(data, panel) {//Shows edit dialog
    this.selected = data || {};
    this.editor = new Panel('Collection info');
    this.editMenu = new Buttons({
        root: this.editor.element,
        maxElements: 3
    });
    _goBackFactory(this.editMenu, this.editor);
    this.editMenu.addButton({
        caption: 'Save',
        handler: _.bind(function() {//Adds new or edits existing
            var form = this.editForm.saveForm();
            syncManager._save('collections', form, _.bind(function (err) {
                if (err) {
                    return _defaultDBError(err);
                };
                manager.goBack(this.editor);
            }, this))
        }, this)
    });
    if (this.selected.id) {//Add remove button
        this.editMenu.addButton({
            caption: 'Remove',
            handler: _.bind(function() {//Adds new or edits existing
                syncManager.storage.select('chapters', ['collection_id', data.id], _.bind(function (err, chapters) {
                    if (err) {
                        return _defaultDBError(err);
                    };
                    for (var i = 0; i < chapters.length; i++) {
                        syncManager.storage.remove('chapters', chapters[i], function (err) {
                            
                        });
                    };
                    syncManager.storage.remove('collections', data, _.bind(function (err) {
                        if (err) {
                            return _defaultDBError(err);
                        };
                        manager.goBack(this.editor);
                        manager.goBack(this.chaptersPanel);
                    }, this))
                }, this))
            }, this)
        });
    };
    this.editForm = new AutoForm(this.editor.element, {
        name: {label: 'Name:', value: this.selected.name},
        code: {label: 'Code:', value: this.selected.code},
    });
    manager.show(this.editor, panel || this.panel);
};

Collections.prototype.showCollection = function(data) {//Shows chapters
    this.selected = data || {};
    this.chaptersPanel = new Panel(data.name || 'Untitled');
    this.chaptersMenu = new Buttons({
        root: this.chaptersPanel.element, 
        maxElements: 2
    });
    this.showAll = false;
    _goBackFactory(this.chaptersMenu, this.chaptersPanel);
    this.chaptersMenu.addButton({
        caption: 'Edit',
        handler: _.bind(function() {//Show edit dialog
            this.editDialog(this.selected, this.chaptersPanel);
        }, this)
    });
    this.chaptersMenu.addButton({
        caption: 'Add new',
        handler: _.bind(function() {//Show add chapter dialog
            this.addChapterPanel = new Panel('New chapter');
            this.addChapterMenu = new Buttons({
                root: this.addChapterPanel.element,
                maxElements: 2
            });
            _goBackFactory(this.addChapterMenu, this.addChapterPanel);
            this.addChapterMenu.addButton({
                caption: 'Save',
                handler: _.bind(function() {//Insert new chapter
                    var form = this.chapterForm.saveForm();
                    var lines = _importText(form.text);
                    if (lines.length == 0) {//Show error
                        _showError('Text is empty');
                        return;
                    };
                    var chunks = [];
                    var chunkSize = parseInt(form.size) || 0;
                    var chunkLines = lines[0];
                    var linesInChunk = 1;
                    for (var i = 1; i < lines.length; i++) {//
                        if (chunkLines.length+lines[i].length<chunkSize || chunkSize == 0) {//Add line to chunk
                            chunkLines += '\n'+lines[i];
                            linesInChunk++;
                        } else {//Save chunk
                            chunks.push({lines: chunkLines, count: linesInChunk});
                            chunkLines = lines[i];
                            linesInChunk = 1;
                        };
                    };
                    chunks.push({lines: chunkLines, count: linesInChunk});
                    var gr = new AsyncGrouper(chunks.length, _.bind(function(gr) {//All inserts are done
                        var oks = 0;
                        var errs = 0;
                        for (var i = 0; i < gr.statuses.length; i++) {//
                            if (gr.statuses[i]) {//Done
                                oks++;
                            } else {//Error
                                errs++;
                            };
                        };
                        _showInfo('Import done: '+oks+' times, failed: '+errs+' times');
                        manager.goBack(this.addChapterPanel);
                    }, this));
                    var linesAdded = 0;
                    for (var i = 0; i < chunks.length; i++) {//Call insert for every chunk
                        var chunk = chunks[i];
                        var title = form.title;
                        if (chunks.length>1 && title) {//Multi chunks
                            title += ' '+(linesAdded+1)+'-'+(linesAdded+chunk.count)+' of '+lines.length;
                        };
                        linesAdded += chunk.count;
                        syncManager._save('chapters', {
                            name: title,
                            text: chunk.lines,
                            read: 0,
                            collection_id: this.selected.id,
                            date_created: new Date().getTime()
                        }, gr.fn);
                    };
                }, this)
            });
            this.chapterForm = new AutoForm(this.addChapterPanel.element, {
                title: {label: 'Title:', value: ''},
                size: {label: 'Chunk size (chars) max:', value: '500'},
                text: {label: 'Text:', value: '', type: 'textarea'}
            });
            manager.show(this.addChapterPanel, this.chaptersPanel);
        }, this)
    });
    this.chaptersMenu.addButton({
        caption: 'Show all',
        handler: _.bind(function(e, btn) {//Invert show all, refresh
            this.showAll = !this.showAll;
            this.chaptersMenu.setCaption(btn, this.showAll? 'Show unread': 'Show all');
            this.chaptersPanel.onSwitch();
        }, this)
    });
    this.chapters = new Buttons({
        root: this.chaptersPanel.element,
        maxElements: 1
    });
    this.chaptersPanel.onSwitch = _.bind(function() {//Reload chapters
        var readCond = '';
        var limit = '';
        var params = ['collection_id', this.selected.id];
        if (!this.showAll) {//Add read = 0
            params.push('read', 0);
        };
        this.chapters.clear();
        syncManager.storage.select('chapters', params, _.bind(function (err, data) {
            if (err) {
                return _defaultDBError(err);
            };
            for (var i = 0; i < data.length; i++) {
                this.chapters.addButton({
                    caption: data[i].name || (new Date(data[i].date_created).format('mm/dd HH:MM:ss')),
                    data: data[i],
                    safe: true,
                    className: 'button_left'+(data[i].read>0? ' chapter_read': ''),
                    classNameInner: 'button_list',
                    handler: _.bind(function(e, btn) {//Click on chapter
                        //log('Show text viewer', btn.data.id);
                        var lines = btn.data.text.split('\n');
                        var id = btn.data.id;
                        var title = btn.caption;
                        var tv = new TextViewer({
                            lines: lines,
                            panel: this.chaptersPanel,
                            title: title,
                            chapters: this,
                            id: id
                        });
                    }, this)
                });
            };
        }, this), {limit: '10'})
    }, this);
    manager.show(this.chaptersPanel, this.panel);
};

var ListsManager = function(panel) {
    _createEsentials(this, 'Lists:', 1);
    _goBackFactory(this.topMenu, this.panel);
    this.textPanel = $('<div/>').addClass('input_wrap').appendTo(this.panel.element);
    this.text = $('<input type="text"/>').addClass('form_control').appendTo(this.textPanel);
    this.text.bind('keydown', _.bind(function(e) {
        if (e.which == 13) {//Enter
            var val = this.text.val();
            if (val) {
                syncManager._save('lists', {
                    name: val,
                    selected: 0,
                    listed: 0
                }, _.bind(function (err) {
                    if (err) {
                        return _defaultDBError(err);
                    };
                    this.reload();
                }, this))
                this.text.val('');
            };
            return false;
        };
        return true;
    }, this));
    this.list = $('<div/>').appendTo(this.panel.element);
    manager.show(this.panel, panel);
    this.reload();
};

ListsManager.prototype.reload = function() {
    syncManager.storage.select('lists', [], _.bind(function (err, data) {
        if (err) {
            return _defaultDBError(err);
        };
        this.list.empty();
        var showRow = function(row) {//
            var div = $('<div/>').addClass('list_row').appendTo(this.list);
            $(_buildIcon(row.selected? 'on': 'off')).appendTo(div).bind('click', _.bind(function() {//
                row.selected = row.selected? 0: 1;
                syncManager._save('lists', row, _.bind(function (err) {
                    this.reload();
                }, this))
                return false;
            }, this));
            $(_buildIcon(row.listed? 'on': 'off')).appendTo(div).bind('click', _.bind(function() {//
                row.listed = row.listed? 0: 1;
                syncManager._save('lists', row, _.bind(function (err) {
                    this.reload();
                }, this))
                return false;
            }, this));
            $(_buildIcon('bin')).appendTo(div).bind('click', _.bind(function() {//
                syncManager.storage.select('words', ['list_id', row.id], _.bind(function (err, data) {
                    if (err) {
                        return _defaultDBError(err);
                    };
                    for (var i = 0; i < data.length; i++) {
                        syncManager.storage.remove('words', data[i], function (err) {
                            
                        });
                    };
                    syncManager.storage.remove('lists', row, _.bind(function (err) {
                        this.reload();
                    }, this))
                }, this))
                return false;
            }, this));
            div.bind('click', _.bind(function(e) {
                new ListManager(this.panel, row);
                return false;
            }, this))
            $('<span/>').appendTo(div).text(row.name);
        };
        for (var i = 0; i < data.length; i++) {
            showRow.call(this, data[i]);
        };
    }, this), {order: ['name']})
};

var NewWordEditor = function(panel, id, data, keep_open) {//
    _createEsentials(this, 'Word editor:', 2);
    _goBackFactory(this.topMenu, this.panel);
    this.topMenu.addButton({
        caption: 'Save',
        handler: _.bind(function() {
            var form = this.form.saveForm();
            if (!form.kanji || !form.kana || !form.trans) {
                _showError('All fields are mandatory');
                return;
            };
            if (data && data.id) {//Update
                data.kanji = form.kanji;
                data.kana = form.kana;
                data.trans = form.trans;
                syncManager._save('words', data, _.bind(function (err) {
                    if (err) {
                        return _defaultDBError(err);
                    };
                    if (keep_open) {
                        _showInfo('Word updated');
                    } else {
                        manager.goBack(this.panel);
                    };
                }, this))
            } else {
                syncManager.storage.select('words', ['kanji', form.kanji], _.bind(function (err, data) {
                    if (err) {
                        return _defaultDBError(err);
                    };
                    if (data.length>0) {
                        _showError('Word already added');
                        return;
                    };
                    form.score = 0;
                    form.tries = 0;
                    form.list_id = id;
                    syncManager._save('words', form, _.bind(function (err) {
                        if (err) {
                            return _defaultDBError(err);
                        };
                        if (keep_open) {
                            _showInfo('Word added');
                        } else {
                            manager.goBack(this.panel);
                        };
                    }, this));
                }, this))
            };
        }, this),
    });
    this.form = new AutoForm(this.panel.element, {
        kanji: {label: 'Kanji:',},
        kana: {label: 'Kana:',},
        trans: {label: 'Translation:',},
    }, 'word', data);
    manager.show(this.panel, panel);
};

var ListManager = function(panel, list) {
    this.data = list;
    _createEsentials(this, 'Words ('+list.name+'):', 2);
    _goBackFactory(this.topMenu, this.panel);
    this.topMenu.addButton({
        caption: 'New word',
        handler: _.bind(function() {
            new NewWordEditor(this.panel, list.id, null, true);
        }, this),
    });
    this.list = $('<div/>').appendTo(this.panel.element);
    this.panel.onSwitch = _.bind(function() {
        this.reload();
    }, this)
    manager.show(this.panel, panel);
};


ListManager.prototype.reload = function() {
    syncManager.storage.select('words', ['list_id', this.data.id], _.bind(function (err, data) {
        if (err) {
            return _defaultDBError(err);
        };
        this.list.empty();
        var showRow = function(row) {//
            var div = $('<div/>').addClass('list_row').appendTo(this.list);
            $(_buildIcon('bin')).appendTo(div).bind('click', _.bind(function() {//
                syncManager.storage.remove('words', row, _.bind(function (err) {
                    this.reload();
                }, this))
                return false;
            }, this));
            var pr = $('<div/>').addClass('word_progress').appendTo(div);
            var inner = $('<div/>').addClass('word_progress_green').appendTo(pr);
            if (row.rating == -1) {
                inner.addClass('word_progress_red').css('width', '100%');
            } else {
                inner.css('width', ''+Math.floor(row.rating*50)+'%');
            };
            div.bind('click', _.bind(function(e) {
                new NewWordEditor(this.panel, this.data.id, row, true);
                return false;
            }, this))
            $('<span/>').appendTo(div).text(row.kanji+'/'+row.kana+'/'+row.trans);
        };
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            row.rating = row.tries>0? row.score/row.tries: -1;
        };
        data = data.sort(function(a, b) {
            return a.rating == b.rating? 0: (a.rating>b.rating? -1: 1);
        });
        for (var i = 0; i < data.length; i++) {
            showRow.call(this, data[i]);
        };
        
    }, this), {order: ['kana']})
};

var _kanjiProxy = function(method, params, handler) {
    if (method == 'getWords') {
        syncManager.storage.select('lists', ['selected', 1], _.bind(function (err, data) {
            var gr = new AsyncGrouper(data.length, _.bind(function (gr) {
                var err = gr.findError();
                if (err) {
                    return _defaultDBError(err);
                };
                var res = [];
                for (var i = 0; i < data.length; i++) {
                    var words = gr.results[i][0];
                    for (var j = 0; j < words.length; j++) {
                        var row = words[j];
                        row.rating = row.tries>0? row.score/row.tries: -1;
                        if (row.rating<=params[0]) {
                            res.push(row);
                        };
                    };
                };
                handler(res.sort(function(a, b) {
                    return a.rating == b.rating? 0: (a.rating>b.rating? 1: -1);
                }));

            }, this));
            for (var i = 0; i < data.length; i++) {
                syncManager.storage.select('words', ['list_id', data[i].id], gr.fn);
            };
        }, this));
        return true;
    };
    if (method == 'getKanji') {
        var arr = [];
        if (!kanjiXML) {
            return handler(arr);
        };
        for (var i = 0; i < params[0].length; i++) {
            var ch = params[0].charAt(i);
            var found = false;
            for (var j = 0; j < kanjiXML.length; j++) {//
                var items = $(kanjiXML[j]).find('ji[kanji="'+ch+'"]');
                if (items.size() > 0) {//Not found
                    var ji = items.get(0);
                    arr.push(ji);
                    found = true;
                    break;
                };
            };
            if (!found) {
                arr.push($('<ji/>').get(0));
            };
        };
        handler(arr);
        return true;
    };
    if (method == 'showInfo') {
        _showInfo(params[0]);
        return true;
    };
    if (method == 'setInt') {
        db.set(params[0], params[1]);
        return true;
    };
    if (method == 'getInt') {
        return parseInt(db.get(params[0], params[1]));
    };
    if (method == 'saveAnswer') {
        syncManager.findOne('words', params[0], _.bind(function (err, obj) {
            if (err) {
                return handler(null, err);
            };
            obj.score += params[1];
            obj.tries++;
            syncManager._save('words', obj, _.bind(function (err, obj) {
                if (err) {
                    return handler(null, err);
                };
                handler(params[0]);
            }, this))
        }, this))
        return true;
    };
};

var openKanjiPanel = function(panel, forceinline) {
    if (CURRENT_PLATFORM == PLATFORM_AIR && !forceinline) {
        new KanjiWindow(panel);
    } else {
        new KanjiPanel(panel);
    };
};

var _kanjiWin = null;

var KanjiWindow = function(panel) {//
    if (_kanjiWin && !_kanjiWin.closed) {
        _kanjiWin.close();
    };
    _kanjiWin = openToolWindow('dict-sheet.html', _kanjiProxy, {x: 10, y: 10, width: parseInt(db.get('kanji_panel_width', '300')), height: 300}).nativeWindow;
};

var KanjiPanel = function(panel) {//
    _createEsentials(this, 'Kanji:', 3);
    _goBackFactory(this.topMenu, this.panel);
    this.topMenu.addButton({
        caption: 'Slower',
        handler: _.bind(function() {
            this.controller.changeTimeout(1);
        }, this)
    });
    this.topMenu.addButton({
        caption: 'Faster',
        handler: _.bind(function() {
            this.controller.changeTimeout(-1);
        }, this)
    });
    this.panelPlace = $('<div/>').insertBefore(this.topMenu.element);
    this.controller = new KanjiPanelElement(this.panelPlace, _kanjiProxy);
    this.levelMenu = new Buttons({
        root: this.panel.element,
        maxElements: 2
    });
    this.levelMenu.addButton({
        caption: 'Level up',
        handler: _.bind(function() {
            this.controller.changeLevel(-1);
        }, this),
    });
    this.levelMenu.addButton({
        caption: 'Level down',
        handler: _.bind(function() {
            this.controller.changeLevel(1);
        }, this),
    });
    manager.show(this.panel, panel)
};
