var _buildIcon = function(name, cl) {//Builds img html
    return '<div class="icon'+(cl? ' '+cl: '')+'" style="background-image: url(\'img/'+name+'.png\');"/>';
};

var KanjiPanelElement = function(element, proxy, popup) {
    this.root = element;
    this.proxy = proxy;
    this.darkTheme = this.proxy('getInt', ['panel_theme', 1])? true: false;
    this.timeout = this.proxy('getInt', ['panel_timeout', 10]);
    this.level = this.proxy('getInt', ['panel_level', 2]);
    this.wordsShown = 0;
    this.wordsPart = 0;
    this.wordsPartTotal = 4;
    this.studyMode = false;
    this.menu = $('<div/>').addClass('kanji_panel_menu').appendTo(this.root);
    this.status = $('<div/>').addClass('kanji_panel_status kanji_panel_text').appendTo(this.menu);
    $(_buildIcon('bg', 'icon32 draggable')).appendTo(this.menu).bind('click', _.bind(function() {
        this.root.toggleClass('kanji_panel_bg');
        return false;
    }, this)).bind('dragstart', _.bind(function(e) {
        e.preventDefault();
        this.moving();
    }, this));
    $(_buildIcon('theme', 'icon32 draggable')).appendTo(this.menu).bind('click', _.bind(function() {
        this.darkTheme = !this.darkTheme;
        this.setTheme();
        this.showWord(this.next);
        this.proxy('setInt', ['panel_theme', this.darkTheme? 1: 0]);
        return false;
    }, this)).bind('dragstart', _.bind(function(e) {
        e.preventDefault();
        this.moving();
    }, this));
    //if (popup) {//
        //$(_buildIcon('hand', 'icon32 draggable')).appendTo(this.menu).bind('dragstart', _.bind(function(e) {
            //e.preventDefault();
            //this.moving();
        //}, this));
    //};
    $(_buildIcon('study', 'icon32')).appendTo(this.menu).bind('click', _.bind(function() {
        this.studyMode = !this.studyMode;
        if (this.studyMode) {//Show
            this.studyPanel.show();
            if (this.nextWordID) {
                clearTimeout(this.nextWordID);
            };
            this.nextStudyWord();
        } else {
            this.kanaPanel.css('visibility', 'visible');
            this.translatePanel.css('visibility', 'visible');
            this.studyPanel.hide();
            this.loadWords();
        };
        this.updated();
        return false;
    }, this));
    this.right = $('<div/>').addClass('kanji_panel_right').appendTo(this.root);
    this.canvas = $('<canvas/>').addClass('kanji_panel_canvas').appendTo(this.right);
    this.ctx = canto(this.canvas.get(0));
    this.kanaPanel = $('<div/>').addClass('kanji_panel_translate kanji_panel_text kanji_panel_kana').appendTo(this.right);
    this.translatePanel = $('<div/>').addClass('kanji_panel_translate kanji_panel_text').appendTo(this.right);
    $('<div style="clear: both;"/>').appendTo(this.root);
    this.studyPanel = $('<div/>').addClass('kanji_panel_study').appendTo(this.root).hide();
    this.studyIcons = $('<div/>').addClass('kanji_panel_study_icons').appendTo(this.studyPanel);
    this.red = $(_buildIcon('flag_red', 'icon32')).appendTo(this.studyIcons).bind('click', _.bind(function() {
        this.saveAnswer(0);
        return false;
    }, this));
    this.orange = $(_buildIcon('flag_orange', 'icon32')).appendTo(this.studyIcons).bind('click', _.bind(function() {
        this.saveAnswer(1);
        return false;
    }, this));
    this.green = $(_buildIcon('flag_green', 'icon32')).appendTo(this.studyIcons).bind('click', _.bind(function() {
        this.saveAnswer(2);
        return false;
    }, this));
    var w = $('<div/>').addClass('kanji_panel_study_text').appendTo(this.studyPanel);
    this.input = $('<input type="text"/>').appendTo(w);
    this.input.bind('keydown', _.bind(function(e) {
        if (!this.studyMode) {
            return true;
        };
        if (e.which == 13) {//Enter
            if (!this.answered) {//
                this.checkAnswer(this.input.val());
            } else {
                this.saveAnswer(this.answer);
            };
            return false;
        };
        if (e.which == 45 && this.answered) {
            this.saveAnswer(0);
        };
        if (e.which == 36 && this.answered) {
            this.saveAnswer(1);
        };
        if (e.which == 33 && this.answered) {
            this.saveAnswer(2);
        };
    }, this))
    $('<div style="clear: both;"/>').appendTo(this.studyPanel);
    this.loadWords();
    this.setTheme();
};

KanjiPanelElement.prototype.setTheme = function() {//
    if (this.darkTheme) {
        this.root.find('.kanji_panel_text').removeClass('kanji_panel_bright');
        this.root.removeClass('kanji_panel_bg_bright');
    } else {
        this.root.find('.kanji_panel_text').addClass('kanji_panel_bright');
        this.root.addClass('kanji_panel_bg_bright');
    };
};

KanjiPanelElement.prototype.checkAnswer = function(text) {//
    this.kanaPanel.css('visibility', 'visible');
    this.translatePanel.css('visibility', 'visible');
    this.answered = true;
    if (text == this.next.kana) {//2
        this.green.addClass('kanji_panel_answer');
        this.answer = 2;
        return;
    };
    if (text) {//2
        this.orange.addClass('kanji_panel_answer');
        this.answer = 1;
        return;
    };
    this.red.addClass('kanji_panel_answer');
    this.answer = 0;
};


KanjiPanelElement.prototype.saveAnswer = function(score) {
    this.proxy('saveAnswer', [this.next.id, score], _.bind(function() {
        if (this.words.length>1) {//
            this.words.splice(this.nextPos, 1);
        };
        this.nextStudyWord();
    }, this))
};

KanjiPanelElement.prototype.nextStudyWord = function() {
    this.selectNext();
    this.kanaPanel.css('visibility', 'hidden');
    this.translatePanel.css('visibility', 'hidden');
    this.input.val('');
    this.studyPanel.find('.kanji_panel_answer').removeClass('kanji_panel_answer');
    this.answered = false;
    this.showWord(this.next);
};

KanjiPanelElement.prototype.changeTimeout = function(delta) {
    if (this.studyMode) {
        return false;
    };
    this.timeout += delta;
    if (this.timeout<1) {
        this.timeout = 1;
    };
    this.proxy('setInt', ['panel_timeout', this.timeout]);
    if (this.nextWordID) {
        clearTimeout(this.nextWordID);
    };
    this.proxy('showInfo', ['Delay is '+this.timeout+' sec']);
    this.nextWord();
};

KanjiPanelElement.prototype.changeLevel = function(delta) {
    if (this.studyMode) {
        return false;
    };
    this.level += 0.5*delta;
    this.proxy('setInt', ['panel_level', this.level]);
    if (this.nextWordID) {
        clearTimeout(this.nextWordID);
    };
    this.loadWords();
};

KanjiPanelElement.prototype.updated = function() {};//Default
KanjiPanelElement.prototype.moving = function() {};//Default

KanjiPanelElement.prototype.loadWords = function() {
    this.proxy('getWords', [this.level], _.bind(function(data) {
        this.words = data;
        this.nextWord();
    }, this))
};

KanjiPanelElement.prototype.drawKanji = function(index, data, group) {//
    var nl = data.getElementsByTagName('p');
    for ( var i = 0; i < nl.length; i++) {
        var p = nl.item(i);
        var gr = parseInt(p.getAttribute('g'));
        if (gr != group && group != -1) {
            continue;
        };
        this.ctx.save().beginPath().svgpath(p.getAttribute('d')).stroke({lineWidth: 5, lineCap: 'round', strokeStyle: this.darkTheme? '#222222': '#eeeeee'}).endPath().restore();
    }
};

KanjiPanelElement.prototype.showWord = function(next) {//
    if (!next) {
        this.status.text('Error!');
        return;
    };
    this.status.text(''+this.level+'/'+this.timeout+'/'+this.nextPos+'/'+this.words.length+'/'+this.wordsShown+'/'+(Math.floor(next.rating*10)/10)+'/'+next.tries);
    this.wordsShown++;
    var cWidth = this.right.innerWidth();
    var cHeight = Math.ceil(cWidth/3);
    this.ctx.width = cWidth;
    this.ctx.height = cHeight;
    this.kanaPanel.text(next.kana);
    this.translatePanel.text(next.trans);
    this.proxy('getKanji', [next.kanji], _.bind(function(arr) {
        var dim = Math.floor(cWidth/Math.max(3, arr.length));
        for (var i = 0; i < arr.length; i++) {
            this.ctx.save();
            this.ctx.translate(dim*i+(cWidth-arr.length*dim)/2, (cHeight-dim)/2);
            var gap = 5;
            this.ctx.beginPath().rect(gap, gap, dim-gap, dim-gap).stroke({strokeStyle: '#dddddd', lineWidth: 1}).endPath();
            var sc = (dim-2*gap)/109;
            this.ctx.translate(gap, gap).scale(sc, sc);
            this.drawKanji(i, arr[i], -1);
            this.ctx.restore();
            this.updated();
        };
    }, this))
};

KanjiPanelElement.prototype.selectNext = function() {
    this.wordsPart++;
    if (this.wordsPart>this.wordsPartTotal) {
        this.wordsPart = 1;
    };
    this.nextPos = Math.floor(Math.random()*this.words.length/this.wordsPart);
    this.next = this.words[this.nextPos];
};

KanjiPanelElement.prototype.nextWord = function() {
    this.selectNext();
    this.showWord(this.next);
    this.nextWordID = setTimeout(_.bind(function() {
        if (this.wordsShown % 10 == 0) {
            this.loadWords();
        } else {
            this.nextWord();
        };
    }, this), this.timeout*1000);
};
