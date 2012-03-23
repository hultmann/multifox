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
 * Portions created by the Initial Developer are Copyright (C) 2010
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


function onRemoteBrowserMessage(message) {
  // this = nsIChromeFrameMessageManager
  var browser = message.target;
  var tab = findTabByBrowser(browser);
  console.assert(tab !== null, "tab not found");
  var tabLogin = new TabLogin(tab);

  var msgData = message.json;
  if (msgData.url) {
    msgData.uri = Services.io.newURI(msgData.url, null, null);
  }

  switch (msgData.msg) {
    case "cookie":
      var loginContent = findFrameLogin(msgData, tabLogin);
      return documentCookie(msgData, loginContent);

    case "localStorage":
      var loginContent = findFrameLogin(msgData, tabLogin);
      return windowLocalStorage(msgData, loginContent);

    case "new-doc":
      return DocOverlay.getNewDocData(msgData, tabLogin);

    case "error":
      console.assert(message.sync === false, "use sendAsyncMessage!");
      enableErrorMsg("sandbox", msgData, tab);
      return null;

    case "send-tab-data":
      console.assert(message.sync === false, "use sendAsyncMessage!");
      if (tabLogin.hasUser) {
        var msgData2 = DocOverlay.getInitBrowserData();
        msgData2.msg = "tab-data";
        browser.messageManager.sendAsyncMessage("multifox-parent-msg", msgData2);
      }
      return null;

    default:
      throw new Error("onRemoteBrowserMessage: " + JSON.stringify(msgData, null, 2));
  }
}


function findTabByBrowser(browser) {
  var tabs = browser.getTabBrowser().mTabContainer.childNodes;
  for (var idx = tabs.length - 1; idx > -1; idx--) {
    if (tabs[idx].linkedBrowser === browser) {
      return tabs[idx];
    }
  }
  return null;

}


function windowLocalStorage(msgData, loginContent) {
  var uri = loginContent.formatUri(msgData.uri);

  var principal = Cc["@mozilla.org/scriptsecuritymanager;1"]
                  .getService(Ci.nsIScriptSecurityManager)
                  .getCodebasePrincipal(uri);

  var storage = Cc["@mozilla.org/dom/storagemanager;1"]
                .getService(Ci.nsIDOMStorageManager)
                .getLocalStorageForPrincipal(principal, "");

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
      rv = storage.getItem(msgData.cmdKey);
      break;
    case "key":
      rv = storage.key(msgData.cmdIndex);
      break;
    case "length":
      rv = storage.length;
      break;
    default:
      throw new Error("localStorage interface unknown: " + msgData.cmdMethod);
  }
  return {responseData: rv};
}


function documentCookie(msgData, loginContent) {
  switch (msgData.cmdMethod) {
    case "set":
      console.assert(loginContent.isLoggedIn, "documentCookieSetter not logged in=" + loginContent.toString()); // login cancelled, mas document já foi interceptado
      Cookies.setCookie(loginContent, msgData.uri, msgData.cmdValue, true);
      return null;

    case "get":
      var val = "foo@documentCookie";
      console.assert(loginContent.isLoggedIn, "documentCookieGetter not logged=" + loginContent.toString() + "," + msgData.uri.host);
      try {
        var cookie = Cookies.getCookie(true, msgData.uri, loginContent);
        val = cookie === null ? "" : cookie;
      } catch (ex) {
        console.trace(ex);
      }
      return {responseData: val};
    default:
      throw new Error("documentCookie " + msgData.cmdMethod);
  }
}


function findFrameLogin(msgData, tabLogin) {
  // tabLogin can be anon and the new tabLogin can be a different login (e.g. domWin=facebook iframe)
  if (msgData.top) {
    if (tabLogin.isLoginInProgress) {
      if (tabLogin.hasLoginInProgressMoveData) {
        // data already moved to new user
        tabLogin = TabLoginHelper.getLoginInProgress(tabLogin.tabElement);
      }
    }
    return tabLogin;
  }


  // origin=>iframe


  if (tabLogin.isLoginInProgress) {
    if (tabLogin.hasLoginInProgressMoveData) {
      return TabLoginHelper.getLoginInProgress(tabLogin.tabElement);
    } else {
      return tabLogin;
    }
  }


  var tld = getTldFromHost(msgData.uri.host);
  var iframeLogin = LoginDB.getDefaultLogin(tld, tabLogin);
  if (iframeLogin !== null) {
    return iframeLogin;

  } else {
    // iframe tld is not a logged in tab ==> third party iframe
    console.log("findFrameLogin - executing method from anon iframe", tld, "- top");
    // BUG qdo google pergunta soh a senha, começa a validar youtube etc, mas nao ha logininprogress e login falha
    return tabLogin.toAnon();
  }
}
