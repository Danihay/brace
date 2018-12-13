ace.define("ace/mode/logpathon_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (acequire, exports, module) {
  "use strict";

  var oop = acequire("../lib/oop");
  var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

  var LogpathonHighlightRules = function () {

    this.$rules = {
      start: [{
          token: 'storage.modifier',
          regex: '\\b(lang:[\\w:]*)'
        },
        {
          token: ["link", "variable.language"],
          regex: /((?:https?:\/\/|ftp:\/\/|file:\/\/|mailto:|callto:)[^\s\[]+)(\[.*?\])/
        },
        {
          token: "link",
          regex: /(?:https?:\/\/|ftp:\/\/|file:\/\/|mailto:|callto:)[^\s\[]+/
        },
        {
          token: "option",
          regex: /ERROR.+$/
        },
        {
          token: "pageBreak",
          regex: /WARN(ING)?.+$/,
        }
      ]
    };

    this.normalizeRules();

    function quoteRule(ch) {
      var prefix = /\w/.test(ch) ? "\\b" : "(?:\\B|^)";
      return prefix + ch + "[^" + ch + "].*?" + ch + "(?![\\w*])";
    }

    //addQuoteBlock("text")

    var tokenMap = {
      pageBreak: "string",
      option: "string.regexp",
      escape: "constant.language.escape",
      link: "markup.underline.list"
    };

    for (var state in this.$rules) {
      var stateRules = this.$rules[state];
      for (var i = stateRules.length; i--;) {
        var rule = stateRules[i];
        if (rule.include || typeof rule == "string") {
          var args = [i, 1].concat(this.$rules[rule.include || rule]);
          if (rule.noEscape) {
            args = args.filter(function (x) {
              return !x.next;
            });
          }
          stateRules.splice.apply(stateRules, args);
        } else if (rule.token in tokenMap) {
          rule.token = tokenMap[rule.token];
        }
      }
    }
  };

  oop.inherits(LogpathonHighlightRules, TextHighlightRules);

  exports.LogpathonHighlightRules = LogpathonHighlightRules;
});

ace.define("ace/mode/logpathon", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/logiql_highlight_rules", "ace/mode/folding/coffee", "ace/token_iterator", "ace/range", "ace/mode/behaviour/cstyle", "ace/mode/matching_brace_outdent"], function (acequire, exports, module) {
  "use strict";

  var oop = acequire("../lib/oop");
  var TextMode = acequire("./text").Mode;
  var LogpathonHighlightRules = acequire("./logpathon_highlight_rules").LogpathonHighlightRules;
  var TokenIterator = acequire("../token_iterator").TokenIterator;
  var Range = acequire("../range").Range;
  var CstyleBehaviour = acequire("./behaviour/cstyle").CstyleBehaviour;
  var MatchingBraceOutdent = acequire("./matching_brace_outdent").MatchingBraceOutdent;

  var Mode = function () {
    this.HighlightRules = LogpathonHighlightRules;
    this.$outdent = new MatchingBraceOutdent();
    this.$behaviour = new CstyleBehaviour();
  };
  oop.inherits(Mode, TextMode);

  (function () {
    this.lineCommentStart = "//";
    this.blockComment = {
      start: "/*",
      end: "*/"
    };

    this.getNextLineIndent = function (state, line, tab) {
      var indent = this.$getIndent(line);

      var tokenizedLine = this.getTokenizer().getLineTokens(line, state);
      var tokens = tokenizedLine.tokens;
      var endState = tokenizedLine.state;
      if (/comment|string/.test(endState))
        return indent;
      if (tokens.length && tokens[tokens.length - 1].type == "comment.single")
        return indent;

      var match = line.match();
      if (/(-->|<--|<-|->|{)\s*$/.test(line))
        indent += tab;
      return indent;
    };

    this.checkOutdent = function (state, line, input) {
      if (this.$outdent.checkOutdent(line, input))
        return true;

      if (input !== "\n" && input !== "\r\n")
        return false;

      if (!/^\s+/.test(line))
        return false;

      return true;
    };

    this.autoOutdent = function (state, doc, row) {
      if (this.$outdent.autoOutdent(doc, row))
        return;
      var prevLine = doc.getLine(row);
      var match = prevLine.match(/^\s+/);
      var column = prevLine.lastIndexOf(".") + 1;
      if (!match || !row || !column) return 0;

      var line = doc.getLine(row + 1);
      var startRange = this.getMatching(doc, {
        row: row,
        column: column
      });
      if (!startRange || startRange.start.row == row) return 0;

      column = match[0].length;
      var indent = this.$getIndent(doc.getLine(startRange.start.row));
      doc.replace(new Range(row + 1, 0, row + 1, column), indent);
    };

    this.getMatching = function (session, row, column) {
      if (row == undefined)
        row = session.selection.lead;
      if (typeof row == "object") {
        column = row.column;
        row = row.row;
      }

      var startToken = session.getTokenAt(row, column);
      var KW_START = "keyword.start",
        KW_END = "keyword.end";
      var tok;
      if (!startToken)
        return;
      if (startToken.type == KW_START) {
        var it = new TokenIterator(session, row, column);
        it.step = it.stepForward;
      } else if (startToken.type == KW_END) {
        var it = new TokenIterator(session, row, column);
        it.step = it.stepBackward;
      } else
        return;

      while (tok = it.step()) {
        if (tok.type == KW_START || tok.type == KW_END)
          break;
      }
      if (!tok || tok.type == startToken.type)
        return;

      var col = it.getCurrentTokenColumn();
      var row = it.getCurrentTokenRow();
      return new Range(row, col, row, col + tok.value.length);
    };
    this.$id = "ace/mode/logpathon";
  }).call(Mode.prototype);

  exports.Mode = Mode;
});
