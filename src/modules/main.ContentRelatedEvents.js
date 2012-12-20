/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var ContentRelatedEvents = {

  init: function() {
    var obs = Services.obs;
    obs.addObserver(this._onOuterDestroyed, "outer-window-destroyed", false);
    obs.addObserver(this._onInnerDestroyed, "inner-window-destroyed", false);
    obs.addObserver(this._onDOMCreated,  "document-element-inserted", false);
  },


  uninit: function() {
    var obs = Services.obs;
    obs.removeObserver(this._onOuterDestroyed, "outer-window-destroyed");
    obs.removeObserver(this._onInnerDestroyed, "inner-window-destroyed");
    obs.removeObserver(this._onDOMCreated,  "document-element-inserted");
  },


  initWindow: function(win) {
    UIUtils.getContentContainer(win)
           .addEventListener("pageshow", this._onPageShow, false);
    var mm = win.messageManager;
    mm.addMessageListener("${BASE_ID}-remote-msg", this._onRemoteBrowserMessage);
    mm.loadFrameScript("${PATH_MODULE}/remote-browser.js", true);
  },


  uninitWindow: function(win, reason) {
    UIUtils.getContentContainer(win)
           .removeEventListener("pageshow", this._onPageShow, false);
    if (reason === "closing window") {
      return;
    }
    // disabling Multifox
    var srcCode = this._loadResetCode();
    var mm = win.messageManager;
    mm.removeDelayedFrameScript("${PATH_MODULE}/remote-browser.js");
    mm.removeMessageListener("${BASE_ID}-remote-msg", this._onRemoteBrowserMessage);
    mm.sendAsyncMessage("${BASE_ID}-parent-msg", {msg: "disable-extension", src: srcCode});
  },


  _loadResetCode: function() {
    var src = null;
    var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    xhr.onload = function() {
      src = xhr.responseText;
    };
    xhr.open("GET", "${PATH_CONTENT}/content-injection-reset.js", false);
    xhr.overrideMimeType("text/plain");
    xhr.send(null); // synchronous
    return src;
  },


  _onInnerDestroyed: {
    observe: function(subject, topic, data) {
      var id = subject.QueryInterface(Ci.nsISupportsPRUint64).data;
      WinMap.removeInner(id);
    }
  },


  _onOuterDestroyed: {
    observe: function(subject, topic, data) {
      var id = subject.QueryInterface(Ci.nsISupportsPRUint64).data;
      WinMap.removeOuter(id);
    }
  },


  _onRemoteBrowserMessage: function Content_onRemoteBrowserMessage(message) {
    // this = nsIChromeFrameMessageManager
    try {
      var browser = message.target;
      var tab = UIUtils.getLinkedTabFromBrowser(browser);
      if (tab === null) { // social-sidebar-browser etc
        return null; // TODO assert "new-doc"?
      }

      var msgData = message.json;
      if ("url" in msgData) {
        if (msgData.url.length > 0) {
          msgData.uri = Services.io.newURI(msgData.url, null, null);
        } else {
          msgData.uri = null;
        }
      }
      return RemoteBrowserMethod[msgData.msg](msgData, tab);

    } catch (ex) {
      console.error(ex);
    }
  },


  _onDOMCreated: { // TODO it will replace DOMWindowCreated
    observe: function(subject, topic, data) {
      var win = subject.defaultView;
      if (win === null) {
        return; // xsl/xbl chrome://....xml
      }

      var innerId = getDOMUtils(win).currentInnerWindowID;
      if (innerId in WinMap._inner) {
        var entry = WinMap.getInnerEntry(innerId);
        entry["x-document-element-inserted"] = win.location.href;
      }
    }
  },


  // pageshow event => call updateUIAsync for bfcache or non http/https protocols
  _onPageShow: function(evt) {
    try {
      var doc = evt.target; // pageshow handler
      var win = doc.defaultView;

      if (isSupportedScheme(win.location.protocol)) {
        // BUG rightclick>show image ==> evt.persisted=false
        // BUG google login persists: google => br.mozdev=>back=>fw
        var fromCache = evt.persisted;
        if (fromCache) {
          // http top doc from cache: update icon
          var tab = UIUtils.getLinkedTab(win);
          if (tab !== null) {
            var innerId = getDOMUtils(win).currentInnerWindowID;
            var data = WinMap.getInnerEntry(innerId);
            if ("docUserObj" in data) {
              var tabId = WinMap.getTabId(data.outerId);
              var docUser = data.docUserObj;
              UserState.setTabDefaultFirstParty(docUser.ownerTld, tabId, docUser.user); // BUG [?] a 3rd party iframe may become the default
            }
            updateUIAsync(tab, isTopWindow(win));
          }
        }

      } else { // ftp:, about:, chrome: etc. request/response listener may not be called
        var tab = UIUtils.getLinkedTab(win);
        if (tab !== null) {
          updateUIAsync(tab, isTopWindow(win));
        }
      }


    } catch (ex) {
      console.error(ex);
    }
  }

};



var RemoteBrowserMethod = {

  cookie: function(msgData) {
    var docUser = WinMap.getSavedUser(msgData.inner, msgData.url); // TODO send .uri instead of .url
    if (docUser === null) {
      // the last user has been removed; one or more tabs now use the default user
      // BUG we need to send the correct cookie
      console.warn("cookie docUser=null", msgData);
      return null; // TODO docUser=null for unnecessarily customized docs
    }

    switch (msgData.cmdMethod) {
      case "set":
        Cookies.setCookie(docUser, msgData.uri, msgData.cmdValue, true);
        return null;

      case "get":
        var val = "foo@documentCookie";
        try {
          var cookie = Cookies.getCookie(true, docUser.appendLoginToUri(msgData.uri));
          val = cookie === null ? "" : cookie;
        } catch (ex) {
          console.trace(ex);
        }
        return {responseData: val};

      default:
        throw new Error("documentCookie " + msgData.cmdMethod);
    }
  },


  localStorage: function(msgData) {
    var docUser = WinMap.getSavedUser(msgData.inner, msgData.url);
    if (docUser === null) {
      console.warn("localStorage docUser=null", msgData);
      return null; // BUG should return the actual data
    }

    var uri = docUser.appendLoginToUri(msgData.uri);
    var ssm = Cc["@mozilla.org/scriptsecuritymanager;1"].getService(Ci.nsIScriptSecurityManager);
    var principal = ssm.getNoAppCodebasePrincipal(uri);

    var dsm = Cc["@mozilla.org/dom/storagemanager;1"].getService(Ci.nsIDOMStorageManager);
    var storage = dsm.getLocalStorageForPrincipal(principal, "");

    var rv;
    switch (msgData.cmdMethod) {
      case "clear":
        storage.clear();
        return null;
      case "removeItem":
        storage.removeItem(msgData.cmdKey);
        return null;
      case "setItem":
        storage.setItem(msgData.cmdKey, msgData.cmdVal); // BUG it's ignoring https
        return null;
      case "getItem":
        return {responseData: storage.getItem(msgData.cmdKey)};
      case "key":
        return {responseData: storage.key(msgData.cmdIndex)};
      case "length":
        return {responseData: storage.length};
      default:
        throw new Error("localStorage interface unknown: " + msgData.cmdMethod);
    }
  },


  "new-doc": function(msgData, tab) {
    var isTop = WinMap.isTabId(msgData.parentOuter);
    var customize = NewDocUser.addNewDocument(msgData);
    if (customize) {
      if (isTop) {
        updateUIAsync(tab, true); // make sure icon is removed if pending_login is never defined
      } else {
        var innerObj = WinMap.getInnerEntry(msgData.inner);
        if (("pending_login" in innerObj) === false) { // TODO temp
          updateUIAsync(tab, false);
        }
      }
      // tell remote browser to apply script to document
      return "initBrowser" in msgData ? DocOverlay.getInitBrowserData() : {};
    } else {
      updateUIAsync(tab, isTop); // remove icon
      return null; // ignore document
    }
  },


  "error": function(msgData, tab) {
    //console.assert(message.sync === false, "use sendAsyncMessage!");
    enableErrorMsg("sandbox", msgData, tab);
    return null;
  },


  "send-inj-script": function(msgData, tab) {
    //console.assert(message.sync === false, "use sendAsyncMessage!");
    if (LoginDB.hasLoggedInHost(msgData.hosts)) {
      var msgData2 = DocOverlay.getInitBrowserData();
      msgData2.msg = "tab-data";
      tab.linkedBrowser
         .messageManager
         .sendAsyncMessage("${BASE_ID}-parent-msg", msgData2);
    }
    return null;
  }

};
