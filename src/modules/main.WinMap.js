/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var NewDocUser = {

  addNewDocument: function(msgData) {
    var outerEntry = {
      __proto__: null,
      type: "domcreated",
      "inner-id": msgData.inner,
      "original-url": msgData.url
    };

    if ("x-frameElement.src" in msgData) {
      outerEntry["frameSrc"] = msgData["x-frameElement.src"];
    }
    if ("parentUrl" in msgData) {
      outerEntry.parent = msgData.parentUrl;
    }
    if ("openerUrl" in msgData) {
      outerEntry.opener = msgData.openerUrl;
    }

    var outerData = WinMap.addToOuterHistory(outerEntry, msgData.outer, msgData.parentOuter);

    // a location can be about:blank or "" at DOMWindowCreated. The real url will be known later.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=696416#c1
    PendingUsersLogins.check(msgData, outerData, "domcreated");

    var innerObj = WinMap.addInner(msgData);

    var isUndefined = (msgData.url.length === 0) || (msgData.url === "about:blank");
    if (isUndefined) {
      // we don't know yet if it is a logged in doc, so we need to customized it.
      // pode ser a logged in doc or anon.
      innerObj.pending_login = true; // URL is unknown, we cannot define docuser. afaik, it will be same as parent.
      outerEntry["x-doc-customized"] = true;
      return true;
    }

    var docUser = WinMap.getUserFromDocumentOrParent(msgData.uri, msgData.outer, msgData.parentInner)
    if (docUser !== null) {
      innerObj.docUserObj = docUser; // used by assets/iframes
      outerEntry.x_login = docUser;
      if (docUser.user.isNewAccount === false) {
        outerEntry["x-doc-customized"] = true;
        return true;
      }
    }

    return false; // TODO ignore inners without login
  },


  addDocumentRequest: function(msgData, channel) {
    var isTop = WinMap.isTabId(msgData.parentInner);
    var tldPrev = isTop ? CrossTldLogin.getPrevDocTld(msgData.outer) : null; // should be called before addToOuterHistory

    var entry = {
      __proto__: null,
      type: "request-doc", // "request"
      visibleInnerId: msgData.inner, // "previous" inner document
      url:  channel.URI.spec // TODO inutil?
    };

    var outerData = WinMap.addToOuterHistory(entry, msgData.outer);

    PendingUsersLogins.check(msgData, outerData, "request");
    var docUser = WinMap.getUserFromDocumentOrParent(channel.URI, msgData.outer, msgData.parentInner);

    if (isTop && (docUser === null)) {
      // BUG docUser from a logged in iframe never will be != null
      docUser = CrossTldLogin.parse(msgData.outer, channel.URI, tldPrev);
      if (docUser !== null) {
        entry["x-tld-login"] = true;
      }
    }

    if (docUser !== null) {
      entry.reqDocUserObj = docUser; // used by response
    }
    return docUser;
  },


  // getLoginForDocumentResponse
  // currentInnerId (possibly) is going to be replace by a new document
  addDocumentResponse: function(channel, currentInnerId, outerId/*, parentOuter*/) {
    var stat = channel.responseStatus;
    var entry = {
      __proto__:   null,
      type:        "response-doc",
      http_status: stat,
      contentType: channel.contentType,
      visibleInnerId: currentInnerId,
      url:            channel.URI.spec
    };
    if (stat !== 200) {
      // 301, 302, 303?
      try {
        var locat = channel.getResponseHeader("location");
        entry.x_redir = locat;
      } catch (ex) {
      }
    }

    WinMap.addToOuterHistory(entry, outerId);

    // should fetch login from request, because it could be a not logged in iframe
    // (which should inherit login from parent)
    var log = this._findDocRequest(currentInnerId, outerId);
    console.assert(log !== null, "reponse without a request");
    var docUser = "reqDocUserObj" in log ? log.reqDocUserObj : null;
    if (docUser !== null) {
      entry.x_login_obj = docUser; // for debug
    }
    return docUser;
  },


  _findDocRequest: function(innerId, outerId) {
    var outerDataLog = WinMap.getOuterEntry(outerId).outerHistory;
    for (var idx = outerDataLog.length - 1; idx > -1; idx--) {
      var req = outerDataLog[idx];
      if (req.type === "request-doc") {
        if (req.visibleInnerId === innerId) {
          return req;
        }
      }
    }
    return null;
  },


  viewSourceRequest: function(sourceWin, uri) { // sourceWin = viewSource.xul
    var chromeWin = UIUtils.getTopLevelWindow(sourceWin);
    if (chromeWin && chromeWin.opener) {
      if (UIUtils.isMainWindow(chromeWin.opener)) {
        var selTab = UIUtils.getSelectedTab(chromeWin.opener);
        return WinMap.getUserFromDocument(uri, getIdFromTab(selTab), true);
      }
    }
    // BUG null for anon iframes (we would need to know its parent). find focused frame?
    console.log("viewSourceRequest null", sourceWin, uri);
    return null;
  }

};



var WinMap = { // stores all current outer/inner windows
   TopWindowFlag: -1,

  _outer: Object.create(null),
  _inner: Object.create(null),
  _remove: true, // for debug


  removeOuter: function(id) {
    if (this._remove) {
      delete this._outer[id];
    } else {
      if (this._outer[id]) {
        this._outer[id]["x-deleted"] = true;
      }
    }
  },


  removeInner: function(id) {
    if (this._remove) {
      // _inner[id] may not exist (not a content window).
      delete this._inner[id]; // it will keep references in _outer
    } else {
      if (this._inner[id]) {
        this._inner[id]["x-deleted"] = true;
      }
    }
  },


  _addWindow: function(win) { // called recursively by _update for all documents in a tab
    var parentOuterId;
    var parentInnerId;
    if (isTopWindow(win)) {
      parentOuterId = WinMap.TopWindowFlag;
      parentInnerId = WinMap.TopWindowFlag;
    } else {
      var parent = getDOMUtils(win.parent);
      parentOuterId = parent.outerWindowID;
      parentInnerId = parent.currentInnerWindowID;
    }

    var utils = getDOMUtils(win);
    var outerId = utils.outerWindowID;
    var innerId = utils.currentInnerWindowID;

    if (outerId in WinMap._outer === false) {
      WinMap.addToOuterHistory({
        __proto__: null,
        type: "enable/update"
      }, outerId, parentOuterId);
    }

    if (innerId in WinMap._inner === false) {
      WinMap.addInner({
        url: win.location.href,
        inner: innerId,
        outer: outerId,
        parentInner:parentInnerId
      });
    }
  },


  _update: function() {
    function forEachWindow(fn, win) {
      fn(win);
      for (var idx = win.length - 1; idx > -1; idx--) {
        forEachWindow(fn, win[idx]);
      }
    }

    var enumWin = UIUtils.getWindowEnumerator();
    while (enumWin.hasMoreElements()) {
      var tabList = UIUtils.getTabList(enumWin.getNext());
      for (var idx = tabList.length - 1; idx > -1; idx--) {
        forEachWindow(WinMap._addWindow, tabList[idx].linkedBrowser.contentWindow);
      }
    }
  },


  getOuterEntry: function(id) {
    if (id in this._outer) {
      return this._outer[id];
    }
    this._update();
    console.assert(id in this._outer, "getOuterEntry - outerId not found", id);
    return this._outer[id];
  },


  getInnerEntry: function(id) {
    if (id in this._inner) {
      return this._inner[id];
    }
    this._update();
    console.assert(id in this._inner, "getInnerEntry - innerId not found", id);
    return this._inner[id];
  },


  addInner: function(msgData) {
    var innerObj = {
      __proto__: null,
      "url": msgData.url,
      "outerId": msgData.outer,
      "parentInnerId": msgData.parentInner
    };

    // all inner windons should be preserved to allow a page from bfcache to use its original login
    console.assert((msgData.inner in this._inner) === false, "WinMap.addInner", msgData.inner);
    this._inner[msgData.inner] = innerObj;
    return innerObj;
  },


  loginSubmitted: function(win, data) { // TODO move to CrossLogin?
    var entry = {
      __proto__: null,
      type:      "pw-submit",
      submitted: data,
      tld: getTldFromHost(win.location.hostname)
    };
    WinMap.addToOuterHistory(entry, getDOMUtils(win).outerWindowID);
  },


  addToOuterHistory: function(newHistObj, outerId, parentId) {
    var outerData;
    if (outerId in this._outer) {
      outerData = this._outer[outerId];
      outerData["x-history-length"]++;
    } else {
      console.assert(typeof parentId !== undefined, "missing parentId");
      outerData = {
        __proto__: null,
        parentOuter: parentId, // TODO parentId
        outerHistory: []
      };
      this._outer[outerId] = outerData;
      outerData["x-history-length"] = 1;
    }
    this._pushHistory(newHistObj, outerData.outerHistory);
    return outerData;
  },


  _pushHistory: function(entry, outerHistory) {
    if (outerHistory.length > 30) {
      var delQty = outerHistory.length - 10;
      outerHistory.splice(0, delQty, entry);
    } else {
      outerHistory.push(entry);
    }
  },


  isFrameId: function(parentId) { // outer/inner
    return parentId !== -1;
  },


  isTabId: function(parentId) { // TODO isParentIdTop
    return parentId === -1;
  },


  getTabId: function(outerId) { // TODO findTabIdtab id = outer id from a top window
    console.assert(typeof outerId === "number", "getTabId param")
    var all = this._outer;
    if ((outerId in all) === false) {
      this._update();
    }
    console.assert(outerId in all, "getTabId not found");
    var win = all[outerId];
    while (WinMap.isFrameId(win.parentOuter)) {
      outerId = win.parentOuter;
      win = all[outerId];
    }
    return outerId;
  },


  getUserFromTab: function(tabId) { // tab=top window
    console.assert(WinMap.isTabId(this.getOuterEntry(tabId).parentOuter), "not a top window"); // BUG assert may call _update
    var uri = findTabById(tabId).linkedBrowser.currentURI;
    return this.getUserFromDocument(uri, tabId, true);
  },


  // called by request/domcreated
  getUserFromDocumentOrParent: function(docUri, outerId, parentInnerId) {
    console.assert(docUri.spec !== "about:blank", "getUserFromDocumentOrParent blank");
    var tabId = this.getTabId(outerId);
    var docUser = this.getUserFromDocument(docUri, tabId, false);
    if (docUser === null) { // anon url
      // top documents: do nothing
      // iframe: inherit it from parent
      if (WinMap.isFrameId(parentInnerId)) {
        var parentObj = this.getInnerEntry(parentInnerId);
        if ("docUserObj" in parentObj) {
          // TODO urlDoc and innerObj.url are supposed to be from the same host...
          docUser = parentObj.docUserObj; // identity used by document
        }
      }
    }
    return docUser;
  },


  getUserFromDocument: function(aDocUri, tabId, onlyTab) { // TODO only tld is necessary // BUG rename; used by asset as well
    var tld = getTldFromUri(aDocUri);
    if (tld === null) {
      return null;
    }

    var encTld = StringEncoding.encode(tld);
    if (LoginDB.isLoggedIn(encTld) === false) {
      return null;
    }

    var tabData = this.getOuterEntry(tabId);
    console.assert(WinMap.isTabId(tabData.parentOuter), "getUserFromDocument - tabId is not a top window:", tabId);

    var docUser = null;
    if ("tabLogins" in tabData) {
      if (tld in tabData.tabLogins.firstParty) {
        docUser = tabData.tabLogins.firstParty[tld];
      }
    }

    if (docUser !== null) {
      return docUser;
    }

    if (onlyTab) {
      return null;
    }

    // first time tld is used in this tab?
    var docUser = LoginDB.getDefaultUser(tabId, encTld);
    if (docUser !== null) {
      this.setUserForTab(docUser, tabId);
      return docUser;
    }

    console.log("getUserFromDocument null", tld, aDocUri);
    return null; // aDocUri is anon
  },


  // called by request/response: <img>, <script>, <style>, XHR... (but not <iframe>)
  // called by JS: cookie/localStorage/...
  getUserForAsset: function(innerId, urlDoc, resUri) {
    var entry = this.getInnerEntry(innerId);

    if (resUri !== null) {
      // logged in TLD?
      var tabId = this.getTabId(entry.outerId);
      var docUser = this.getUserFromDocument(resUri, tabId, false);
      if (docUser !== null) {
        return docUser;
      }
    }

    // TODO urlDoc and entry.url should share the hostname

    if ("docUserObj" in entry) {
      return entry.docUserObj; // identity used by document
    }

    if ("pending_login" in entry) {
      console.assert(urlDoc.length > 0, "getUserForAsset empty");
      PendingUsersLogins.fixUserForInnerEntry(innerId, urlDoc);
      if ("docUserObj" in entry) {
        return entry.docUserObj; // identity used by document
      }
    }

    return null;
  },


  restoreTabDefaultUsers: function(tab) {
    if (tab.hasAttribute("multifox-tab-logins") === false) {
      return;
    }
    console.log("restoreDefaultLogins", tab.getAttribute("multifox-tab-logins"));

    var tabLogins;
    try {
      // TODO delay until tab is actually loaded (@ getUserFromDocument?)
      tabLogins = JSON.parse(tab.getAttribute("multifox-tab-logins"));
    } catch (ex) {
      console.error(ex, "restoreTabDefaultUsers - buggy json", tab.getAttribute("multifox-tab-logins"));
      return;
    }

    if (("firstParty" in tabLogins) === false) {
      return;
    }

    var logins = tabLogins.firstParty;
    var tabId = getIdFromTab(tab);
    var obj;
    var userId;
    var docUser;
    for (var tld in logins) {
      obj = logins[tld];
      userId = new UserId(obj.encodedUser, obj.encodedTld);
      docUser = new DocumentUser(userId, tld, tabId);
      this.setUserForTab(docUser, tabId);
    }
  },


  setTabAsNewAccount: function(tabId) {
    var docUser = this.getUserFromTab(tabId);
    var user = new UserId(UserUtils.NewAccount, docUser.user.encodedTld);
    var docUser2 = new DocumentUser(user, docUser.ownerTld, tabId);
    this.setUserForTab(docUser2, tabId);
    return docUser2;
  },


  setWindowAsUserForTab: function(innerId) {
    var data = this.getInnerEntry(innerId);
    if ("docUserObj" in data) {
      console.log("setWindowAsUserForTab FOUND", innerId, data.docUserObj);
      var tabId = this.getTabId(data.outerId);
      this.setUserForTab(data.docUserObj, tabId); // BUG [?] a 3rd party iframe may become the default
    }
  },



  // TODO set the same default for all tlds with the docUser user@tld

  // save currently used login by a tld in a given tab
  setUserForTab: function(docUser, tabId) {
    var tabData = this.getOuterEntry(tabId);
    console.assert(WinMap.isTabId(tabData.parentOuter), "0 not a top window ", tabId, "- Caller should send tabId instead of an outerId/iframe - caller would probably need tabId anyway.");


    var myTld = docUser.ownerTld;
    var replace = true;
    if ("tabLogins" in tabData) {
      if (myTld in tabData.tabLogins.firstParty) {
        // replace?
        if (docUser.equals(tabData.tabLogins.firstParty[myTld])) {
          replace = false;
        }
      }
    } else {
      tabData.tabLogins = {firstParty: Object.create(null)}; // TODO thirdParty:{}
    }

    if (replace) {
      tabData.tabLogins.firstParty[myTld] = docUser;
    }


    if (docUser.isFormTld() === false) {
      // docUser=twitpic/youtube? make twitter.com/google.com default as well
      var tldForm = docUser.user.plainTld;
      tabData.tabLogins.firstParty[tldForm] = docUser.toNewDoc(tldForm);
    }


    // update default for new tabs/occurrences - current tabs will keep their internal defaults
    LoginDB.setDefaultUser(docUser.encodedDocTld, docUser.user);


    // for session restore
    console.log("setUserForTab multifox-tab-logins saved tab", tabId, docUser); // BUG check if it works for new bg tabs
    var tab = findTabById(tabId);
    tab.setAttribute("multifox-tab-logins", JSON.stringify(tabData.tabLogins)); // TODO tabId is useless // TODO add versioning // TODO check if empty
    if (tab.hasAttribute("multifox-tab-error")) {
      // reset error icon
      tab.removeAttribute("multifox-tab-error");
    }
  }

};



var DebugWinMap = {

  toString: function() {
    var usedInners = [];
    var usedOuters = [];
    var output = [];

    for (var id in WinMap._outer) {
      if (WinMap.isTabId(WinMap.getOuterEntry(id).parentOuter)) {
        this._debugOuter(id, output, "", usedOuters, usedInners);
      }
    }

    for (var id in WinMap._outer) {
      if (usedOuters.indexOf(id) === -1) {
        output.unshift("*** outer not displayed " + id, "---");
      }
    }

    for (var id in WinMap._inner) {
      if (usedInners.indexOf(id) === -1) {
        output.unshift("*** inner not displayed " + id, "---");
      }
    }

    return output.join("\n");
  },


  _debugOuter: function(outerId, output, padding, usedOuters, usedInners) {
    var intOuterId = parseInt(outerId, 10);
    var win = getDOMUtils(UIUtils.getMostRecentWindow()).getOuterWindowWithId(intOuterId);

    // removed outer window?
    var currentInner = (win === null) || (win.location === null) ? -1 : getDOMUtils(win).currentInnerWindowID;
    var ok = false;

    for (var innerId in WinMap._inner) {
      var obj = WinMap.getInnerEntry(innerId);
      if (obj.outerId !== intOuterId) {
        continue;
      }
      ok = true;
      usedInners.push(innerId);
      var s = padding;
      s += "x-deleted"        in obj ? "-" : "*";
      s += "x-doc-customized" in obj ? "x" : "*";
      s += "pending_login"    in obj ? "?" : "*";

      s += " " + intOuterId + "[" + innerId + "] ";
      if ("docUserObj" in obj) {
        var docUser = obj.docUserObj;
        s += "{" + docUser.user.plainName + "/" + docUser.user.plainTld + "}  ";
      }
      s += obj.url.substr(0, 140);
      if (obj.url.length === 0) {
        s += "<url empty>";
      }
      if (currentInner === -1) {
        s += " <outer removed>";
      } else {
        if (currentInner === parseInt(innerId, 10)) {
          if (win.location.href !== obj.url) {
            s += " - actual URL: " + win.location.href.substr(0, 140);
          }
        } else {
          s += " <not visible>";
        }
      }
      output.push(s);
    }
    if (ok === false) {
      output.unshift("*** outer without an innerId=" + innerId + " obj.outerId=" + obj.outerId + " intOuterId=" + intOuterId, "---");
    }

    usedOuters.push(outerId);
    for (var outer in WinMap._outer) {
      if (WinMap.getOuterEntry(outer).parentOuter === intOuterId) {
        this._debugOuter(outer, output, padding + "        ", usedOuters, usedInners);
      }
    }
  }

};



var PendingUsersLogins = {

  // called by request/domcreated
  check: function(msgData, outerData, origin) {
    this._fillOpener(msgData, outerData, origin); // TODO needed only for new outer wins

    if (WinMap.isTabId(msgData.parentInner)) {
      // top:
      // _fillOpener (@request/domcreate) already copyed default logins to this new tab/popup.
      if ("openerInnerId" in outerData) {
        var openerObj = WinMap.getInnerEntry(outerData.openerInnerId); // TODO could it not be available anymore?
        if ("pending_login" in openerObj) {
          this.fixUserForInnerEntry(outerData.openerInnerId, outerData.openerUrl); // opener
        }
        console.assert(openerObj.url !== "about:blank", "openerObj.url !== about:blank");
      }

    } else {
      // frame: update parent info
      var parentObj = WinMap.getInnerEntry(msgData.parentInner);
      if ("pending_login" in parentObj) {
        this.fixUserForInnerEntry(msgData.parentInner, msgData.parentUrl);
      }
    }
  },


  _fillOpener: function(msgData, outerData, src) { // TODO still necessary?
    if (("openerOuter" in msgData) === false) {
      return;
    }

    if ("x-opener-order" in outerData) {
      outerData["x-opener-order"] += " " + src;
    } else {
      outerData["x-opener-order"] = src;
    }
    if ("opener-logins-migrated" in outerData) {
      return;
    }

    console.assert(WinMap.isTabId(msgData.parentOuter), "BUG has iframe an opener? maybe, target=nome_iframe");
    if ("openerOuterId" in outerData) {
      console.assert(outerData.openerOuterId === msgData.openerOuter, "outerData.openerOuterId !== msgData.openerOuter");
      console.assert(outerData.openerInnerId === msgData.openerInner, "outerData.openerInnerId !== msgData.openerInner");
    } else {
      outerData.openerInnerId = msgData.openerInner; // TODO opener: {innerId,...}
      outerData.openerOuterId = msgData.openerOuter;
      outerData.openerUrl     = msgData.openerUrl;
    }

    outerData["opener-logins-migrated"] = outerData.openerOuterId;

    var openerTabId = WinMap.getTabId(outerData.openerOuterId);
    var targetTabId = WinMap.getTabId(msgData.outer);
    this._copyLogins(targetTabId, openerTabId);
  },


  _copyLogins: function(targetTabId, sourceTabId) {
    console.assert(targetTabId !== sourceTabId, "_copyLogins same tab", sourceTabId);
    var sourceTabData = WinMap.getOuterEntry(sourceTabId);
    if (("tabLogins" in sourceTabData) === false) {
      return; // nothing to copy
    }

    var targetTabData = WinMap.getOuterEntry(targetTabId);
    if (("tabLogins" in targetTabData) === false) {
      targetTabData.tabLogins = {firstParty: Object.create(null)};
    }

    var targetLogins = targetTabData.tabLogins.firstParty;
    var openerLogins = sourceTabData.tabLogins.firstParty;

    // copy defaults logins to (new?) tab
    for (var tld in openerLogins) {
      // do not overwrite existing logins
      if ((tld in targetLogins) === false) {
        console.log("_copyLogins", tld, openerLogins[tld]);
        targetLogins[tld] = openerLogins[tld].toNewTab(targetTabId);
      }
    }
  },


  // used by check and getUserForAsset
  fixUserForInnerEntry: function(innerId, realDocUrl) {
    var obj = WinMap.getInnerEntry(innerId);
    console.assert("pending_login" in obj, "pending_login fixUserForInnerEntry");
    var tabId = WinMap.getTabId(obj.outerId);
    var isTop = WinMap.isTabId(obj.parentInnerId);
    var inheritOpener = false;
    var inheritParent = false;
    var docUser = null;

    if (realDocUrl === "about:blank") {
      console.log("realDocUrl blank top doc. TEM QUE TER OPENER?", innerId);
      console.trace("fixUserForInnerEntry");
      if (isTop) {
        inheritOpener = true; // is realDocUrl an js top doc? copy login from opener.
      } else {
        inheritParent = true; // is realDocUrl an js iframe? copy login from parent.
      }

    } else {
      console.assert(realDocUrl.length > 0, "realDocUrl empty");
      var uri = Services.io.newURI(realDocUrl, null, null); // TODO remove uri workaround
      docUser = WinMap.getUserFromDocument(uri, tabId, false);
      if ((docUser === null) && (isTop === false)) {
        inheritParent = true; // is realDocUrl an anon iframe? copy login from parent.
      }
    }

    if (inheritOpener) {
      var outerData = WinMap.getOuterEntry(obj.outerId);
      if ("openerInnerId" in outerData) {
        var openerObj = WinMap.getInnerEntry(outerData.openerInnerId);
        if ("docUserObj" in openerObj) {
          docUser = openerObj.docUserObj;
        }
        console.assert(openerObj.url !== "about:blank", "openerObj.url !== about:blank");
      }
    } else if (inheritParent) {
      // innerId is an iframe with an anon url
      // we do not inhreit users for top docs. however, we inhreit all default users from opener tab.
      var parentObj = WinMap.getInnerEntry(obj.parentInnerId);
      console.assert(("pending_login" in parentObj) === false, "pending_login in parentInnerObj");
      if ("docUserObj" in parentObj) {
        docUser = parentObj.docUserObj;
      }
    }


    var entry = {
      __proto__: null,
      type:     "fixed-url",
      inner_id: innerId,
      old_url:  obj.url,
      new_url:  realDocUrl
    };
    WinMap.addToOuterHistory(entry, obj.outerId);


    // current doc url and original can be different. eg:
    // https://mail.google.com/mail/#inbox
    // https://mail.google.com/mail/#spam
    delete obj.pending_login;
    obj.url = realDocUrl; // BUG even about:blank?

    if (docUser !== null) {
      obj.docUserObj = docUser; // TODO uncustomize if docUser=null
    }

    updateUIAsync(findTabById(tabId), isTop);
  }

};
