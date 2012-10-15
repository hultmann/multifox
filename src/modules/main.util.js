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


var StringEncoding = {
  _conv: null,

  init: function() {
    this._conv = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    this._conv.charset = "UTF-8";
  },


  encode: function(str) {
    // chars are > 8bits ("€".charCodeAt(0) = 8364)
    var bin = this._conv.convertToByteArray(str, {});
    var len = bin.length;
    var hex = new Array(len * 2);

    var j = 0;
    var alphabet = "abcdefghijklmnop";

    for (var idx = 0; idx < len; idx++) {
      var myByte = bin[idx];
      var nibble1 = (myByte & 0xf0) >> 4;
      var nibble0 =  myByte & 0x0f;
      hex[j++] = alphabet[nibble1];
      hex[j++] = alphabet[nibble0];
    }

    return hex.join("");
  },


  decode: function(hex) {
    console.assert(typeof hex === "string", "StringEncoding.decode val=" + hex);
    var len = hex.length / 2;
    if (len === 0) {
      return "";
    }

    console.assert((len % 1) === 0, "invalid hex string: " + hex);
    var bin = new Array(len);

    var j = 0;
    var offset = 97; // "abcdefghijklmnop".charCodeAt(0)=97

    for (var idx = 0; idx < len; idx++) {
      var nibble1 = hex.charCodeAt(j++) - offset;
      var nibble0 = hex.charCodeAt(j++) - offset;
      bin[idx] = (nibble1 << 4) | nibble0;
    }

    return this._conv.convertFromByteArray(bin, bin.length);
  }
};


function findTabById(tabId) { // TODO keep a weakref list of tabs
  var winEnum = UIUtils.getWindowEnumerator();
  while (winEnum.hasMoreElements()) {
    var tabList = UIUtils.getTabList(winEnum.getNext());
    for (var idx = tabList.length - 1; idx > -1; idx--) {
      if (getIdFromTab(tabList[idx]) === tabId) {
        return tabList[idx];
      }
    }
  }
  return null;
}


function getIdFromTab(tab) {
  var win = tab.linkedBrowser.contentWindow;
  return getDOMUtils(win).outerWindowID;
}


function isSupportedScheme(scheme) { // TODO check nsIStandardURL
  return (scheme === "http") || (scheme === "https") || (scheme === "http:") || (scheme === "https:");
}


function getDOMUtils(win) {
  return win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
}


function isTopWindow(win) {
  return win === win.top;
}


function getTldFromUri(uri) {
  return isSupportedScheme(uri.scheme) ? getTldFromHost(uri.host) : null;
}


function getTldFromHost(hostname) {
  console.assert(typeof hostname === "string", "invalid hostname argument");
  console.assert(hostname.length > 0, "empty hostname");
  try {
    return Services.eTLD.getBaseDomainFromHost(hostname);
  } catch (ex) {
    var Cr = Components.results;
    switch (ex.result) {
      case Cr.NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS: // "localhost"?
      case Cr.NS_ERROR_HOST_IS_IP_ADDRESS:         // literal ipv6? 3ffe:2a00:100:7031::1
        return hostname;                           // literal ipv4? 127.0.0.1, 0x7f.0.0.1
      case Cr.NS_ERROR_ILLEGAL_VALUE:              // ".foo.tld"?
        break;
      default:
        console.log(ex, hostname);                 // ???
        return hostname;
    }
  }

  // NS_ERROR_ILLEGAL_VALUE
  var firstDot = hostname.indexOf(".");
  //  "local.host" ==> >0 OK
  // ".localhost"  ==>  0 exception
  // ".loc.al.ho.st" ==> 0 exception
  //  "localhost" ==> -1 exception
  if (firstDot === -1) {
    console.log("NS_ERROR_ILLEGAL_VALUE firstDot=-1", hostname);
    return hostname; // ???
  }

  // firstDot=0 ("...local.host") (e.g. from cookies)
  // OBS "..local.host" returns "localhost"
  if (firstDot === 0) {
    return getTldFromHost(hostname.substr(1)); // recursive
  }
  return hostname;
}


function endsWith(sufix, str) { // TODO Fx17 str.endsWith(sufix)
  var idx = str.lastIndexOf(sufix);
  if (idx === -1) {
    return false;
  }
  var idxMatch = str.length - sufix.length;
  return idx === idxMatch;
}


function hasRootDomain(domain, host) {
  if (host === domain) {
    return true;
  }

  var idx = host.lastIndexOf(domain);
  if (idx === -1) {
    return false;
  }

  if ((host.length - domain.length) === idx) {
    return host[idx - 1] === ".";
  }

  return false;
}


function enableErrorMsg(notSupportedFeature, msgData, tab) {
  var msg = ["ERROR"];
  msg.push("Type: " + notSupportedFeature);
  msg.push("URL:  " + msgData.url);
  if (msgData.topUrl) {
    msg.push("Top:  " + msgData.topUrl);
  }

  if (notSupportedFeature === "sandbox") {
    msg.push("Inner ID: " + msgData.innerId);
    var innerObj = WinMap.getInnerEntry(msgData.innerId);
    var entry = {
      __proto__: null,
      type: "sandbox-error",
      "inner-id": msgData.innerId,
      "error": msgData.err
    };
    if (WinMap.isFrameId(innerObj.parentInnerId)) {
      entry.isFrame = true;
    }
    WinMap.addToOuterHistory(entry, innerObj.outerId);
    return;
  }

  msg.push("Desc: " + msgData.err);
  console.log(msg.join("\n"));

  tab.setAttribute("multifox-tab-error", notSupportedFeature);
  updateUIAsync(tab, true);
}


function enableErrorMsgLocal(notSupportedFeature, win) {
  var msgData = {url: win.document.location.href, err: ""};
  msgData.topUrl = win !== win.top ? win.top.document.location.href : "";
  enableErrorMsg(notSupportedFeature, msgData, WindowParents.getTabElement(win));
}


var console = {
  log: function(msg) {
    var now = new Date();
    var ms = now.getMilliseconds();
    var ms2;
    if (ms < 100) {
      ms2 = ms < 10 ? "00" + ms : "0" + ms;
    } else {
      ms2 = ms.toString();
    }
    var p = "${CHROME_NAME}[" + now.toLocaleFormat("%H:%M:%S") + "." + ms2 + "] ";

    var len = arguments.length;
    var msg = len > 1 ? Array.prototype.slice.call(arguments, 0, len).join(" ")
                      : arguments[0];
    Services.console.logStringMessage(p + msg);
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
    this.trace(msg);
  },

  error: function(msg) {
    var ex = new Error(msg);
    Cu.reportError(ex);
    this.trace(msg);
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
    var b = [];
    for (var s = Components.stack; s; s = s.caller) {
      b.push(s);
    }

    var padding = "";
    var t = new Array(b.length);
    for (var idx = b.length - 1; idx > -1; idx--) {
      var s = b[idx];
      var name = s.name === null ? "(anonymous)" : s.name;
      t[idx] = s.languageName + " " + padding + s.filename + "\t\t" + name + "\t" + s.lineNumber;
      padding += " ";
    }
    if (!desc) {
      desc = "console.trace()";
    }
    console.log(desc, "\n" + t.reverse().join("\n"));
  }
};


var util = {
  loadSubScript: function(path) {
    var ns = {};
    Services.scriptloader.loadSubScript(path, ns);
    return ns;
  },

  getText: function(name) {
    return this._getTextCore("general.properties", name, arguments, 1);
  },

  getTextFrom: function(filename, name) {
    return this._getTextCore(filename, name, arguments, 2);
  },

  _getTextCore: function(filename, name, args, startAt) {
    var bundle = Services.strings.createBundle("${PATH_LOCALE}/" + filename);

    if (args.length === startAt) {
      return bundle.GetStringFromName(name);
    } else {
      var args2 = Array.prototype.slice.call(args, startAt, args.length);
      console.assert(args2.length > 0, "_getTextCore");
      return bundle.formatStringFromName(name, args2, args2.length)
    }
  }
};
