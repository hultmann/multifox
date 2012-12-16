/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function copyCookieToNewHost(cookie, newHost) {
  var expiryTime = cookie.isSession ? 4611686018427388 : cookie.expiry; // Math.pow(2, 62)=4611686018427388000
  Services.cookies.add(newHost,         cookie.path,
                       cookie.name,     cookie.value,
                       cookie.isSecure, cookie.isHttpOnly, cookie.isSession, expiryTime);
}


var CookieUtils = {
  getAuthCookies: function() {
    return getAllCookiesFromHost("${INTERNAL_DOMAIN_SUFFIX_LOGGEDIN}");
  },

  getUserCookies: function(user) { // used by removeUser
    var rv = [];
    // "[*select from all hosts*]-[user@gmail.com]-[google.com]"
    var hexlogin = "-" + user.encodedName + "-" + user.encodedTld;
    this._getUserCookies(rv, hexlogin, "${INTERNAL_DOMAIN_SUFFIX_LOGGEDIN}");
    this._getUserCookies(rv, hexlogin, "${INTERNAL_DOMAIN_SUFFIX_ANON}");
    return rv;
  },

  _getUserCookies: function(rv, hexlogin, ns) {
    var all = getAllCookiesFromHost(ns);
    var cookie;
    var suffix = hexlogin + "." + ns;
    for (var idx = all.length - 1; idx > -1; idx--) {
      cookie = all[idx];
      if (cookie.host.endsWith(suffix)) {
        rv.push(cookie);
      }
    }
  }

};


function getAllCookiesFromHost(h) {
  var rv = [];
  var COOKIE = Ci.nsICookie2;

  var _qty = 0;
  var _t = new Date().getTime();

  // TODO use nsICookieManager2.getCookiesFromHost when it works properly
  var all = Services.cookies.enumerator;
  while (all.hasMoreElements()) {
    var cookie = all.getNext().QueryInterface(COOKIE);
    _qty++;
    if (hasRootDomain(h, cookie.host)) {
      rv.push(cookie);
    }
  }

  console.log("getAllCookiesFromHost", h, "time=" + (new Date().getTime() - _t) + "ms -- len parsed=" + _qty + " -- len rv=" + rv.length);
  return rv;
}


function removeCookies(all) {
  console.assert(Array.isArray(all), "all!=array");

  var tlds = [];
  var realTld;
  var realHost;
  var mgr = Services.cookies;
  var cookie;

  for (var idx = all.length - 1; idx > -1; idx--) {
    cookie = all[idx];
    mgr.remove(cookie.host, cookie.name, cookie.path, false);

    // for plugin debug
    realHost = UserUtils.getRealHost(cookie.host);
    if (realHost !== null) {
      realTld = getTldFromHost(realHost);
      if (tlds.indexOf(realTld) === -1) {
        tlds.push(realTld);
      }
    }
  }
  console.log("removeCookies n =", all.length);


  // debug info: log plugin data
  var ph = Cc["@mozilla.org/plugin/host;1"].getService(Ci.nsIPluginHost);
  var pTags = ph.getPluginTags();
  for (var idx1 = pTags.length - 1; idx1 > -1; idx1--) {
    var pl = pTags[idx1];
    try {
      ph.siteHasData(pl, null);
    } catch (ex) {
      continue;
    }

    for (var idx2 = tlds.length - 1; idx2 > -1; idx2--) {
      // it seems siteHasData uses TLD anyway
      if (ph.siteHasData(pl, tlds[idx2])) {
        console.log(pl.name, "siteHasData", tlds[idx2]);
      }
    }

  }
}


function removeTldData_LS(tld) {
  // TODO del localStorage
}


function removeTldData_cookies(tld) { // TODO del ".${INTERNAL_DOMAIN_SUFFIX_ANON}" + ".${INTERNAL_DOMAIN_SUFFIX_LOGGEDIN}"
  var all = getAllCookiesFromHost(tld);
  removeCookies(all);
  return all;
}
