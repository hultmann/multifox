/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const util2 = {

  stringToUri: function(spec) {
    try {
      return Services.io.newURI(spec, null, null);
    } catch (ex) {
      return null;
    }
  },

  logEx: function() {
    var buf = "logEx";// + this.logEx.caller + "\n";// + util2.throwStack._toString(false, Components.stack) + "===";
    for (var idx = 0, len = arguments.length; idx < len; idx++) {
      buf += "\n" + arguments[idx];// + "=" + this.caller[arguments[idx]];
    }

    buf += "\n====\n" + util2.throwStack._toString(false, Components.stack);
    console.log(buf);
  },

  throwStack: {

    go: function(txt) {
      console.log("Stack: " + txt + "\n" + this._toString(false, Components.stack));
      throw txt;
    },

    _toArray: function(webOnly, theStack) {
      var allItems = [];
      if (!theStack) {
        return allItems;
      }

      function StackItem() {}
      StackItem.prototype = {
        lang: "?",
        filename: "?",
        lineNumber: -1,
        name: "?"
      };

      // aparentemente é um bug que ocorre as vezes, todas as propriedades sao undefined
      if (theStack.languageName == undefined) {
        var item = new StackItem();
        item.name = theStack.toString();
        allItems.push(item);
      }

      // myStack.caller é quase sempre null, mas algumas vezes é undefined...
      for (var myStack = theStack; myStack; myStack = myStack.caller) {
        if (webOnly) {
          var n = myStack.filename;
          if (n === null) {
            continue;
          }

          if ((n.indexOf("http:") !== 0) && (n.indexOf("https:") !== 0)) {
            continue;
          }
        }


        var item = new StackItem();
        allItems.push(item);
        item.lang = myStack.languageName;
        item.filename = myStack.filename;
        item.lineNumber = myStack.lineNumber; // Valid line numbers begin at "1". "0" indicates unknown.
        item.name = myStack.name;
      }

      allItems.reverse();
      return allItems;
    },

    _toString: function(webOnly, theStack) {
      var arr = this._toArray(webOnly, theStack);
      var lines = new Array(arr.length);
      for (var idx = arr.length - 1, idx2 = 0; idx > -1; idx--) {
        var lang = webOnly ? "" : arr[idx].lang + " ";
        lines[idx2] = "[" + (idx + 1) + "] "
                    + lang
                    + arr[idx].filename + " "
                    + arr[idx].name + " ("
                    + arr[idx].lineNumber + ")";
        idx2++;
      }
      return lines.join("\n");
    }

  }
};
