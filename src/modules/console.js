/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// shared between main.js and remote-browser.js
var console = {

  _prefix: "${CHROME_NAME}",


  setAsRemote: function() {
    this._prefix = "${CHROME_NAME}[remote]";
  },


  warn: function(msg) {
    var message = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
    message.init(msg,
                 null, // sourceName
                 null, // sourceLine
                 0, 0, // line, col
                 Ci.nsIScriptError.warningFlag,
                 "component javascript");
    Services.console.logMessage(message);
    this.trace(msg); // TODO trace volta uma string
  },


  error: function(ex) {
    Cu.reportError(ex);
    this.console("console.error");
    this.trace(ex.toString());
  },


  assert: function(test, msg) {
    if (test !== true) {
      var ex =  new Error("console.assert - " + msg + " - " + test);
      Cu.reportError(ex); // workaround - sometimes exception doesn't show up in console
      console.trace("console.assert()");
      throw ex;
    }
  },


  trace: function console_trace(desc) {
    if (!desc) {
      desc = "console.trace()";
    }
    console.log(desc, "\n" + this._stackToString(Components.stack));
  },


  log: function() {
    var len = arguments.length;
    var output = new Array(len);
    for (var idx = 0; idx < len; idx++) {
      var arg = arguments[idx];
      switch (typeof arg) {
        case "string":
          output[idx] = arg.length > 0 ? arg : "<empty>";
          break;
        case "number":
        case "boolean":
          output[idx] = arg.toString();
          break;
        case "object":
          output[idx] = this._formatObj(arg);
          break;
        case "undefined":
          output[idx] = "[undefined]";
          break;
        case "function":
          output[idx] = "[" + arg.toString() + "]";
          break;
        default:
          output[idx] = "[???" + arg + " (" + (typeof arg) + ")]";
          break;
      }
    }
    Services.console.logStringMessage(this._prefix +
                                      "[" + this._now() + "] " +
                                      output.join(" "));
  },


  _now: function() {
    var now = new Date();
    var ms = now.getMilliseconds();
    var ms2;
    if (ms < 100) {
      ms2 = ms < 10 ? "00" + ms : "0" + ms;
    } else {
      ms2 = ms.toString();
    }
    return now.toLocaleFormat("%H:%M:%S") + "." + ms2;
  },


  _formatObj: function(obj) {
    if (obj instanceof Error) {
      return "[Error: " + obj.toSource() + "]";

    } else if (obj instanceof Ci.nsIException) {
      return "[nsIException: " + obj.toString() + obj.location + "]\n" + this._stackToString(obj.location);

    } else if (obj instanceof Ci.nsIURI) {
      return "[nsIURI: " + obj.spec + "]";

    } else if (obj instanceof Ci.nsIDOMWindow) {
      return "[" + obj.toString() + " " + obj.location.href + "]";

    } else if (obj instanceof Ci.nsIDOMDocument) {
      return "[" + obj.toString() + " " + obj.defaultView.location.href + "]";

    } else if (obj instanceof Ci.nsIDOMNode) {
      return "[" + obj.toString() + " " +  obj.nodeName + "]";

    } else if (obj instanceof Ci.nsIDOMEvent) {
      return "[" + obj.toString() +
        "\ntype: " + obj.type +
        "\neventPhase: " + ["capture", "target", "bubble"][obj.eventPhase - 1] +
        "\ncurrentTarget:  " + this._formatObj(obj.currentTarget) +
        "\ntarget:         " + this._formatObj(obj.target) +
        "\noriginalTarget: " + this._formatObj(obj.originalTarget) + "]";

    } else if (obj instanceof Ci.nsISupports) {
      if (obj instanceof Object) {
        return "[nsISupports " + obj.toString() + " " + obj.toSource();
      } else {
        return "[nsISupports: " + obj + "]";
      }

    } else {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (ex) {
        if (obj instanceof Object) {
          return obj.toString() + ex;
        } else {
          return "proto=null? " + obj + " " + ex;
        }
      }
    }
  },


  _stackToString: function(stack) {
    var b = [];
    for (var s = stack; s; s = s.caller) {
      b.push(s);
    }

    var padding = "";
    var t = new Array(b.length);
    for (var idx = b.length - 1; idx > -1; idx--) {
      var s = b[idx];
      var name = s.name === null ? "<anonymous>" : s.name;
      var lang = s.languageName === "JavaScript" ? "JS " : s.languageName;
      t[idx] = lang + " " + padding + s.filename + "\t\t" + name + "\t" + s.lineNumber;
      padding += " ";
    }
    return t.reverse().join("\n");
  }

};
