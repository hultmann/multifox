/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function documentCookie(obj, contentDoc) {
  switch (obj.cmd) {
    case "set":
      documentCookieSetter(obj, contentDoc);
      return undefined;
    case "get":
      return documentCookieGetter(obj, contentDoc);
    default:
      throw obj.cmd;
  }
}


function documentCookieGetter(obj, contentDoc) {
  var profileId = FindIdentity.fromContent(contentDoc.defaultView).profileNumber;
  if (Profile.isExtensionProfile(profileId)) {
    var uri = stringToUri(contentDoc.location.href);
    var cookie2 = Cookies.getCookie(true, uri, profileId);
    var cookie = cookie2 === null ? "" : cookie2;
    return cookie; // send cookie value to content
  }
}


function documentCookieSetter(obj, contentDoc) {
  var profileId = FindIdentity.fromContent(contentDoc.defaultView).profileNumber;
  if (Profile.isExtensionProfile(profileId)) {
    var originalUri = stringToUri(contentDoc.location.href);
    Cookies.setCookie(profileId, originalUri, obj.value, true);
  }
}


const PREF_COOKIE_BEHAVIOR = "network.cookie.cookieBehavior";

const Cookies = {
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

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
    // aTopic=nsPref:changed aData=network.cookie.cookieBehavior
    observe: function(aSubject, aTopic, aData) {
      this.behavior = aSubject
                      .QueryInterface(Ci.nsIPrefBranch)
                      .getIntPref(PREF_COOKIE_BEHAVIOR);
      console.log("pref! " + aSubject + aTopic + aData + this.behavior);
    }

  },

  setCookie: function(profileId, originalUri, originalCookie, fromJs) {
    var uri = toInternalUri(originalUri, profileId);
    var val = convertCookieDomain(originalCookie, profileId);

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

  getCookie: function(fromJs, originalUri, profileId) {
    var uri = toInternalUri(originalUri, profileId);

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


function convertCookieDomain(cookieHeader, profileId) {
  var objCookies = new SetCookieParser(cookieHeader, true);
  var len = objCookies.length;
  var newCookies = new Array(len);

  for (var idx = 0; idx < len; idx++) {
    var myCookie = objCookies.getCookieByIndex(idx);
    var realDomain = myCookie.getStringProperty("domain");
    if (realDomain.length > 0) {
      myCookie.defineMeta("domain", cookieInternalDomain(realDomain, profileId));
      newCookies[idx] = myCookie.toHeaderLine();
    } else {
      newCookies[idx] = myCookie.raw;
    }
  }

  return newCookies.join("\n");//objCookies.toHeader();
}


function toInternalUri(uri, sessionId) {
  var u = uri.clone();
  if (Profile.isExtensionProfile(sessionId)) {
    u.host = cookieInternalDomain(u.host, sessionId);
  } else {
    console.trace("invalid profile", sessionId);
  }
  return u;
}


function cookieInternalDomain(domain, id) {
  // this scheme makes Multifox profiles to obey the
  // cookie limits per TLD (network.cookie.maxPerHost)
  var tld = getTldFromHost(domain).replace(".", "-", "g");
  return domain + "." + tld + "-" + id + ".multifox";
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
          console.trace("_allCookies invalid", name, value, headerLine);
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

  getCookie: function(name) {
    var aCookie = this._allCookies;
    for (var idx = 0, len = aCookie.length; idx < len; idx++) {
      if (name === aCookie[idx].name) {
        return aCookie[idx];
      }
    }
    return null;
  },

  forEach: function(fn) {
    var c = this._allCookies;
    for (var idx = 0, len = c.length; idx < len; idx++) {
      fn(c[idx]);
    }
  }
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
