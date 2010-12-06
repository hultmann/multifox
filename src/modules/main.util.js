/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Multifox.
 *
 * The Initial Developer of the Original Code is
 * Jeferson Hultmann <hultmann@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


const util2 = {

  browserWindowsEnum: function() {
    return Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator)
            .getEnumerator("navigator:browser");
  },

  stringToUri: function(spec) {
    var io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    try {
      return io.newURI(spec, null, null);
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
      throw new Error(txt);
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
