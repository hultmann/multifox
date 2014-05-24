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
    if (myCookie.hasMeta("domain")) {
      var newDomain = cookieInternalDomain(myCookie.getMeta("domain"), profileId);
      myCookie.defineMeta("domain", newDomain);
    }
    newCookies[idx] = myCookie.toString();
  }

  return newCookies.join("\n");
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



function SetCookieParser(cookieHeader) {
  this._allCookies = [];
  var lines = this._toLines(cookieHeader);
  for (var idx = 0, len = lines.length; idx < len; idx++) {
    this._parseLine(lines[idx]);
  }
}

SetCookieParser.prototype = {
  _allCookies: null,


  _toLines: function(txt) {
    return txt.split(/\r\n|\r|\n/);
  },


  _parseLine: function(rawSetCookie) {
    var items = rawSetCookie.split(";");
    var unit = new CookieBuilder(items[0]); // [0] "foo=bar"
    var len = items.length;
    if (len > 1) {
      for (var idx = 1; idx < len; idx++) {
        var pair = this._splitValueName(items[idx]);
        unit.defineMeta(pair[0], pair[1]);
      }
    }

    this._allCookies.push(unit);
  },


  _splitValueName: function(cookie) {
    var idx = cookie.indexOf("=");
    if (idx === -1) {
      return [cookie, null];
    }

    // "a=bcd=e".split("=",2) returns [a,bcd]
    //   "abcde".split("=",2) returns [abcde]

    // MY =
    // 012^-----idx=3 length=4

    // MY =a:1=6
    // 012^-----idx=3 length=9

    var nameValue = [cookie.substring(0, idx), ""];
    idx++;
    if (idx < cookie.length) {
      nameValue[1] = cookie.substring(idx);
    }

    return nameValue;
  },


  get length() {
    return this._allCookies.length;
  },

  getCookieByIndex: function(idx) {
    return this._allCookies[idx];
  }
};


function CookieBuilder(cookie) {
  this._cookie = cookie;
  this._meta = Object.create(null);
}

CookieBuilder.prototype = {
  _cookie: null,
  _meta: null,


  hasMeta: function(name) {
    return name in this._meta;
  },


  getMeta: function(name) {
    return name in this._meta ? this._meta[name] : null;
  },


  defineMeta: function(name, val) {
    console.assert(name !== null, "_splitValueName doesn't return null names");
    name = name.trim();
    if (name.length === 0) {
      return; // Set-Cookie:foo=bar;;;
    }
    // val=null ==> name=HttpOnly, secure etc
    this._meta[name.toLowerCase()] = val;
  },


  toString: function() {
    var buf = [this._cookie];
    for (var name in this._meta) {
      var val = this._meta[name];
      buf.push(val === null ? name : name + "=" + val);
    }
    return buf.join(";");
  }
};
