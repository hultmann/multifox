/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var CrossTldLogin = {

  getPrevDocTld: function(outerId) {
    var data = WinMap.getOuterEntry(outerId).outerHistory;
    for (var idx = data.length - 1; idx > -1; idx--) {
      var obj = data[idx];
      if ((obj.type === "request-doc") || (obj.type === "response-doc")) {
        var uri = Services.io.newURI(obj.url, null, null);
        return getTldFromUri(uri);
      }
    }
    return null;
  },


  parse: function(outerId, uriReq, tldPrev) {
    if (tldPrev !== null) {
      var tldReq = getTldFromUri(uriReq);
      if (tldReq !== null) {
        if (tldPrev !== tldReq) {
          return this._crossTldLogin(outerId, uriReq);
        }
      }
    }
    return null;
  },


  _crossTldLogin: function(tabId, reqUri) {
    // tld-0 === tld-2?
    //   tld-1 logged in?
    //     a) tld-2 ==redir==> tld-1                ==redir==> tld-0 OK!
    //     b) tld-2 ==>        tld-1 (submit login) ==redir==> tld-0 OK!

    var reqTld = getTldFromUri(reqUri);
    if (reqTld === null) {
      return null;
    }
    var prevTls = this._getPrevResponses(tabId);
    if (prevTls === null) {
      return null;
    }
    if (prevTls.length < 2) {
      return null;
    }
    if (("prev-2" in prevTls) === false) {
      return null;
    }
    console.log("_crossTldLogin?", prevTls, reqUri);

    if (prevTls["prev-2"] !== reqTld) { // BUG with bfcache? // TODO does newtld exist in *.multifox-anon-2? use as a condition
      return null;
    }

    var uri = Services.io.newURI("http://" + prevTls["prev-1"], null, null);
    var docUser = WinMap.getUserFromDocument(uri, tabId, true);
    if (docUser === null) {
      console.log("_crossTldLogin nop docUser=null");
      return null;
    }


    var lastTld = this._getLastHistoryEntryTld(tabId);
    if (lastTld === null) {
      console.log("_crossTldLogin nop lastTld=null");
      return null;
    }

    var reason = "redir";
    if (lastTld !== reqTld) { // not redirected from prev-2
      if (prevTls.pw === null) {
        console.log("_crossTldLogin nop pw=null");
        return null;
      }
      console.log("pw found", prevTls["prev-1"], prevTls.pw);
      if (prevTls["prev-1"] !== prevTls.pw.tld) {
        console.log("_crossTldLogin nop pw.tld", prevTls["prev-1"], prevTls.pw.tld);
        return null;
      }
      reason = prevTls.pw.submitted; // TODO check redir "prev-1" => "prev-0"
      /*
      if (prevTls.pw.submitted === "login") {
      }
      if (prevTls.pw.submitted === "pw") {
      }
      */
    }

    var newDocUser = new DocumentUser(docUser.user, reqTld, tabId);
    console.log("_crossTldLogin ok", docUser, newDocUser);

    var obj = {
      __proto__: null,
      type: "cross-tld-login",
      param: reason,
      tld_new: reqTld,
      tld: prevTls["prev-1"]
    };
    WinMap.addToOuterHistory(obj, tabId);

    copyData_fromDefault(reqTld, newDocUser); // TODO delete or copy *.multifox-anon-2?
    return newDocUser;
  },


  _getLastHistoryEntryTld: function(tabId) {
    var browser = findTabById(tabId).linkedBrowser;
    var tabHistory = browser.sessionHistory; // nsIHistory
    if (tabHistory === null) {
      return null;
    }

    var idxLast = tabHistory.count - 1;
    var entry = tabHistory.getEntryAtIndex(idxLast, false); // nsIHistoryEntry
    return getTldFromUri(entry.URI);
  },


  _getPrevResponses: function(tabId) {
    var data = WinMap.getOuterEntry(tabId).outerHistory;
    var rv = {
      __proto__: null,
      pw: null
    };
    var idx2 = 1;
    var obj;
    var uri;
    var tld;
    var pw = null;
    var prevTld = " ";
    for (var idx = data.length - 1; idx > -1; idx--) { // BUG if open in new tab (use opener tab?)
      obj = data[idx];
      if (obj.type === "pw-submit") {
        pw = obj;
      }
      if (obj.type !== "response-doc") {
        continue;
      }
      uri = Services.io.newURI(obj.url, null, null);
      tld = getTldFromHost(uri.host); // BUG http/s
      if (prevTld === tld) {
        continue;
      }

      rv["prev-" + idx2] = tld;
      if (idx2 === 2) {
        rv.pw = pw;
      }
      prevTld = tld;
      idx2++;
      if (idx2 > 2) {
        break;
      }
    }

    return rv;
  }

};
