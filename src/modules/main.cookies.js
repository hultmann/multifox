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


var PREF_COOKIE_BEHAVIOR = "network.cookie.cookieBehavior";

var Cookies = {
  _service: null,
  _prefs: null,

  start: function() {
    this._service = Cc["@mozilla.org/cookieService;1"].getService().QueryInterface(Ci.nsICookieService);
    this._prefs = Services.prefs;
    this._prefListener.behavior = this._prefs.getIntPref(PREF_COOKIE_BEHAVIOR);
    this._prefs.addObserver(PREF_COOKIE_BEHAVIOR, this._prefListener, false);
  },

  stop: function() {
    this._service = null;
    this._prefs.removeObserver(PREF_COOKIE_BEHAVIOR, this._prefListener);
    this._prefs = null;
  },


  _prefListener: {
    behavior: -1,

    // nsIObserver
    // topic=nsPref:changed data=network.cookie.cookieBehavior
    observe: function(subject, topic, data) {
      this.behavior = subject
                      .QueryInterface(Ci.nsIPrefBranch)
                      .getIntPref(PREF_COOKIE_BEHAVIOR);
      console.log("pref! " + subject + topic + data + this.behavior);
    }

  },

  setCookie: function(docUser, originalUri, originalCookie, fromJs) {
    var uri = docUser.appendLoginToUri(originalUri);
    var val = convertCookieDomain(originalCookie, docUser);

    if (this._prefListener.behavior === 0) {
      this._setCookie(fromJs, uri, val);
      return;
    }

    var p = this._prefs;
    p.removeObserver(PREF_COOKIE_BEHAVIOR, this._prefListener);
    p.setIntPref(PREF_COOKIE_BEHAVIOR, 0);
    this._setCookie(fromJs, uri, val);
    p.setIntPref(PREF_COOKIE_BEHAVIOR, this._prefListener.behavior);
    p.addObserver(PREF_COOKIE_BEHAVIOR, this._prefListener, false);
  },

  getCookie: function(fromJs, originalUri, uri) {

    if (this._prefListener.behavior === 0) {
      return this._getCookie(fromJs, uri);
    }

    var p = this._prefs;
    p.removeObserver(PREF_COOKIE_BEHAVIOR, this._prefListener);
    p.setIntPref(PREF_COOKIE_BEHAVIOR, 0);
    var cookie = this._getCookie(fromJs, uri);
    p.setIntPref(PREF_COOKIE_BEHAVIOR, this._prefListener.behavior);
    p.addObserver(PREF_COOKIE_BEHAVIOR, this._prefListener, false);
    return cookie;
  },

  _setCookie: function(fromJs, uri, val) {
    if (fromJs) {
      this._service.setCookieString(uri,
                                    null,
                                    val,
                                    null);
    } else {
      //setCookieString doesn't work for httponly cookies
      this._service.setCookieStringFromHttp(uri,   // aURI
                                            null,  // aFirstURI
                                            null,  // aPrompt
                                            val,   // aCookie
                                            null,  // aServerTime
                                            null); // aChannel
    }
  },

  _getCookie: function(fromJs, uri) {
    if (fromJs) {
      return this._service.getCookieString(uri,
                                           null);
    } else {
      return this._service.getCookieStringFromHttp(uri,   // aURI
                                                   null,  // aFirstURI
                                                   null); // aChannel
    }
  }
};


function convertCookieDomain(cookieHeader, docUser) {
  var objCookies = new SetCookieParser(cookieHeader, true);
  var len = objCookies.length;
  var newCookies = new Array(len);

  for (var idx = 0; idx < len; idx++) {
    var myCookie = objCookies.getCookieByIndex(idx);
    var realDomain = myCookie.getStringProperty("domain");
    if (realDomain.length > 0) {
      myCookie.defineMeta("domain", docUser.appendLogin(realDomain));
      newCookies[idx] = myCookie.toHeaderLine();
    } else {
      newCookies[idx] = myCookie.raw;
    }
  }

  return newCookies.join("\n");//objCookies.toHeader();
}


function toLines(txt) {
  return txt.split(/\r\n|\r|\n/);
}


function SetCookieParser(cookieHeader, isSetCookie) { // TODO remove isSetCookie
  this.m_hasMeta = isSetCookie;
  this._allCookies = [];
  if (cookieHeader !== null) {
    var lines = toLines(cookieHeader);
    var len = lines.length;
    if (isSetCookie) {
      for (var idx = 0; idx < len; idx++) {
        this.parseLineSetCookie(lines[idx]);
      }
    } else {
      for (var idx = 0; idx < len; idx++) {
        this.parseLineCookie(lines[idx]);
      }
    }
  }
}

SetCookieParser.prototype = {
  parseLineSetCookie: function(headerLine) {
    var unit = new CookieUnit(headerLine);
    var items = headerLine.split(";");

    for (var idx = 0, len = items.length; idx < len; idx++) {
      var pair = splitValueName(items[idx]);
      var name = pair[0];
      var value = pair[1]; // null ==> name=HttpOnly, secure etc

      if (idx === 0) {
        if (name.length > 0 && value !== null) {
          unit.defineValue(name, value);
        } else {
          console.trace("_allCookies invalid " + name + "/" + value + "/" + headerLine);
          break;
        }
      } else {
        unit.defineMeta(name, value);
      }
    }

    this._allCookies.push(unit);
  },

  parseLineCookie: function(headerLine) {
    var items = headerLine.split(";");
    for (var idx = 0, len = items.length; idx < len; idx++) {
      var unit = CookieUnit(items[idx]);
      var pair = splitValueName(items[idx]);
      unit.defineValue(pair[0], pair[1]);
      this._allCookies.push(unit);
    }
  },

  /*
  toHeader: function() {
    var allCookies = this._allCookies;
    var len = allCookies.length;
    //var buf = [];
    var buf = new Array(len);
    for (var idx = 0; idx < len; idx++) {
      //if (allCookies[idx].value !== null) {
      buf[idx] = allCookies[idx].toHeaderLine();
      //}
    }
    return this.m_hasMeta ? buf.join("\n") : buf.join(";");
  },
  */

  get length() {
    return this._allCookies.length;
  },

  getCookieByIndex: function(idx) {
    return this._allCookies[idx];
  }
};

function CookieUnit(line) {
  this._data = {//instance value
    "_src": line
  };
}

CookieUnit.prototype = {
  _data: null,

  clone: function() {
    var c = new CookieUnit();
    for (var n in this._data) {
      c._data[n] = this._data[n];
    }
    return c;
  },

  get name() {
    var rv = this._data["_name"];
    return rv ? rv : "";
  },

  get value() {
    var rv = this._data["_value"];
    return rv ? rv : "";
  },

  get raw() {
    return this._data["_src"];
  },

  defineValue: function(name, val) {
    this._data["_name"] = name;
    this._data["_value"] = val;
  },

  //"secure":
  //"httponly":
  hasBooleanProperty: function(name) {
    //name = name.toLowerCase();
    return name in this._data;
  },

  setBooleanProperty: function(name, def) {
    if (def) {
      this._data[name] = null;
    } else {
      delete this._data[name];
    }
  },

  //"expires":
  //"domain":
  //"path":
  getStringProperty: function(name) {
    var rv = this._data[name];
    return rv ? rv : "";
    //return rv || "";
  },

  defineMeta: function(name, val) {
    name = name.toLowerCase();
    switch (name) {
      case "expires":
      case "domain":
      case "path":
      case "secure":
      case "httponly":
        this._data[name] = val;
        break;
    }
  },

  toHeaderLine: function() {//toString()
    var buf = [this.name + "=" + this.value];
    var props;

    props = ["secure", "httponly"];
    for (var idx = 0, len = props.length; idx < len; idx++) {
      var propName = props[idx];
      if (this.hasBooleanProperty(propName)) {
        buf.push(propName.toUpperCase());
      }
    }

    props = ["expires", "path", "domain"];
    for (var idx = 0, len = props.length; idx < len; idx++) {
      var propName = props[idx];
      var val = this.getStringProperty(propName);
      if (val.length > 0) {
        buf.push(propName.toUpperCase() + "=" + val);
      }
    }

    return buf.join(";");
  }
};


function splitValueName(cookie) {
  var idx = cookie.indexOf("=");
  if (idx === -1) {
    return [cookie.trim(), null];
  }

  // "a=bcd=e".split("=",2) returns [a,bcd]
  //   "abcde".split("=",2) returns [abcde]


  // MY =
  // 012^-----idx=3 length=4

  // MY =a:1=6
  // 012^-----idx=3 length=9

  var pair = ["", ""];
  pair[0] = cookie.substring(0, idx).trim();
  idx++;
  if (idx < cookie.length) {
    pair[1] = cookie.substring(idx);
  }

  return pair;
}
