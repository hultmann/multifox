/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var console = {
  _prefix: "${CHROME_NAME} ",


  assert: function console_assert(test) {
    if (test === true) {
      return;
    }
    var msg = this._format(test === false
                           ? Array.prototype.slice.call(arguments, 1)
                           : arguments);
    this._print("ASSERT ", msg + "\n" + this._stackToString(Components.stack));
    var ex =  new Error("[console.assert] " + msg);
    Cu.reportError(ex); // workaround - sometimes an exception doesn't show up in console
    throw ex;
  },


  error: function console_error(ex) {
    Cu.reportError("console.error:");
    Cu.reportError(ex);
    this._print("ERROR ", this._format(arguments)); // ex includes stacktrace
  },


  warn: function console_warn(msg) {
    var message = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
    message.init(msg,
                 null, // sourceName
                 null, // sourceLine
                 0, 0, // line, col
                 Ci.nsIScriptError.warningFlag,
                 "component javascript");
    Services.console.logMessage(message);
    this._print("warn ", this._format(arguments));
  },


  trace: function console_trace() {
    this._print("trace ", this._format(arguments) + "\n" +
                this._stackToString(Components.stack));
  },


  log: function console_log() {
    this._print("", this._format(arguments));
  },


  _print: function(name, content) {
    dump("\n-- " + this._prefix + name + this._now() +
         " -------------------------------------------------------\n" +
         content + "\n");
  },


  _format: function(args) {
    var len = args.length;
    var output = new Array(len);
    for (var idx = 0; idx < len; idx++) {
      var arg = args[idx];
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
    return output.join(" ");
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

    } else if (obj instanceof Ci.nsISimpleEnumerator) {
      var name = "";
      var qty = 0;
      while (obj.hasMoreElements()) {
        name += obj.getNext();
        qty++;
      }
      return "[" + obj.toString() + " " + qty + " " + name + "]";

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
