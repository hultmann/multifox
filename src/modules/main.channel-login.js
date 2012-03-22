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
 * Portions created by the Initial Developer are Copyright (C) 2011
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


function getLoginForRequest(channel, win) {
  var tabLogin = TabLoginHelper.getFromDomWindow(win);
  if (tabLogin === null) {
    var chromeWin = WindowParents.getChromeWindow(win);
    if (chromeWin && (chromeWin.document.documentURI === "chrome://global/content/viewSource.xul")) {
      // view source window
      return OpenerWindowIdentity.findFromOpenerSelectedTab(win);
    }
    return null; // tab not found: request from chrome (favicon, updates, <link rel="next"...)
  }


  var requestUri = channel.URI;
  if (isSupportedScheme(requestUri.scheme) === false) {
    // tabLogin is invalid ==> use default session
    tab.removeAttribute("multifox-tab-current-tld");
    tabLogin.setTabAsAnon();
    return null;
  }


  if (isWindowChannel(channel)) {
    // channel will create a document (top or frame)
    if (tabLogin.isLoginInProgress) { // flagged by SubmitObserver
      console.log("isLoginInProgress new doc", channel.URI.spec);
      // obs: getLoginInProgress and getFromDomWindow may both be valid (and different)
      tabLogin = TabLoginHelper.getLoginInProgress(tabLogin.tabElement);
      onNewDoc_moveData_loginSubmitted(tabLogin); // login may be successful, so move cookies now. it may be canceled later.
      return tabLogin;
    }

    if (isTopWindow(win)) {
      // channel will replace the current top document
      return defineTopWindowLogin(requestUri, tabLogin);
    } else {
      // frames shouldn't modify tab identity (obs: frames may have a login, e.g. facebook)
      return getSubElementLogin(requestUri.host, tabLogin, null);
    }

  } else {
    // img, css, xhr...
    if (tabLogin.isLoginInProgress) {
      // A XHR may set a cookie in default session after a login is detected.
      // We should use login for subelements only after data is moved to a Multifox session.
      if (tabLogin.hasLoginInProgressMoveData) {
        tabLogin = TabLoginHelper.getLoginInProgress(tabLogin.tabElement);
      }
    }
    return getSubElementLogin(requestUri.host, tabLogin, win);
  }
}


function defineTopWindowLogin(requestUri, prevLogin) {
  console.log("defineTopWindowLogin", requestUri.spec);
  var tab = prevLogin.tabElement;
  var redirInvalidated = tab.hasAttribute("multifox-redir-invalidate");
  if (redirInvalidated) {
    RedirDetector.resetTab(tab);
  }

  var requestTld = getTldFromHost(requestUri.host);
  var prevTopTld = null; // null => new tab or unsupported scheme
  if (tab.hasAttribute("multifox-tab-current-tld")) {
    prevTopTld = tab.getAttribute("multifox-tab-current-tld");
    if (prevTopTld === requestTld) {
      // prevLogin is still valid!
      // BUG login happens in another tab => this one will keep anonymous (LoginDB.getDefaultLogin is never called)
      return prevLogin.isNewUser ? null : prevLogin;
    }
  }

  // New TLD! (prevLogin is [probably] invalid for the new top document)

  var newLogin = defineNewTldLogin(requestTld, tab, prevLogin, prevTopTld, redirInvalidated);
  if (newLogin === null) {
    prevLogin.setTabAsAnon(); // there is no login provider for requestTld
  } else {
    newLogin.saveToTab();
  }
  updateUI(tab); // show new user now (instead of waiting new dom)
  return newLogin;
}


function defineNewTldLogin(requestTld, tab, prevLogin, prevTopTld, redirInvalidated) {
  var prevPrevTopTld = tab.hasAttribute("multifox-tab-previous-tld")
                     ? tab.getAttribute("multifox-tab-previous-tld") : null;

  // we know 3 TLDs:
  //   requestTld     - new tld
  //   prevTopTld     - previous tld (associated with prevLogin)
  //   prevPrevTopTld - previous to previous tld

  tab.setAttribute("multifox-tab-previous-tld", prevTopTld);
  tab.setAttribute("multifox-tab-current-tld", requestTld);

  console.log("new tld", prevPrevTopTld, "==>", prevTopTld, '==>', requestTld);

  // cross login in progress
  var commitCrossLogin = inheritFromPreviousTld(redirInvalidated, prevPrevTopTld, prevTopTld, requestTld, prevLogin);
  if (commitCrossLogin) {
    console.log("COMMITCROSSLOGIN", redirInvalidated, prevPrevTopTld, prevTopTld, requestTld, prevLogin);
    //tab.ownerDocument.defaultView.alert("commitCrossLogin "+ "\n"+redirInvalidated+ "\n"+ prevPrevTopTld+ "\n"+ prevTopTld+ "\n"+ requestTld+ "\n"+ prevLogin);
    copyData_fromDefault(requestTld, prevLogin); // requestTld=default
    tab.setAttribute("multifox-cross-login-commited-wait-landing-page", "true");
    tab.linkedBrowser.addEventListener("DOMContentLoaded", checkEmptyPage, false);
    return prevLogin;
  }

  // cross login done
  if (tab.hasAttribute("multifox-cross-login-commited-wait-landing-page")) {
    return prevLogin;
  }

  // popups
  if (tab.ownerDocument.documentElement.hasAttribute("multifox-window-uninitialized")) { // BUG com sessionrestore, vai processar ao abrir nova aba; considerar o no. de abas?
    tab.ownerDocument.documentElement.removeAttribute("multifox-window-uninitialized");
    // prevLogin is from opener
    var openerPrevLogin = OpenerWindowIdentity.findFromWindow(tab.linkedBrowser.contentWindow);
    if (openerPrevLogin !== null) {
      // opener tab found
      prevLogin = TabLoginHelper.create(tab, openerPrevLogin.encodedUser, openerPrevLogin.encodedTld);
    }
  }

  // prevLogin: may keep user => different tld, same login
  return LoginDB.getDefaultLogin(requestTld, prevLogin);
}


// tab element = css, img, iframe, ... ==> not called for top doc, so tabLogin is already valid
function getSubElementLogin(elemUriHost, tabLogin, elementWindow) {
  var tldElem = getTldFromHost(elemUriHost);

  if (elementWindow === null) {
    // elemUri is an iframe!
    var a = LoginDB.getDefaultLogin(tldElem, tabLogin); // tabLogin = dummy value
    if (a !== null) {
      // frame has a known login
      console.log("getSubElementLogin iframe login found!", tldElem);
      return a;
    }

    // resource
    return tabLogin.toAnon();
  }


  // ==> img/style/script

  if (isTopWindow(elementWindow) === false) {
    // elemUri = elem inside elementWindow (an iframe) ==> different TLD from tab?
    // elementWindow.documentURIObject may be null
    var iframe = elementWindow.location;
    var schFrame = iframe.protocol.substr(0, iframe.protocol.length - 1);
    //console.log("getSubElementLogin element/iframe", tldElem, elementWindow, schFrame, elementWindow.location, "/", elementWindow.documentURIObject === null, elementWindow.documentURIObject);
    if (isSupportedScheme(schFrame) === false) {
      return null;
    }
    var iframeLogin = LoginDB.getDefaultLogin(getTldFromHost(iframe.hostname), tabLogin); // tabLogin = dummy value

    if (iframeLogin !== null) {
      if (iframeLogin.isNewUser) {
        return null;
      }
      if (LoginDB.isTldLoggedIn(tldElem, iframeLogin.encodedUser, iframeLogin.encodedTld)) { // TODO WTF
        return iframeLogin;
      }
    }

    // resource
    //console.log("getSubElementLogin anonResource", tldElem);
    return tabLogin.toAnon();
  }


  // resource (css/js) from top window

  if (tabLogin.isLoggedIn === false) {
    return null;
  }

  // tldLogin = google.com
  // tab host = www.youtube.com
  // elemUri  = img.youtube.com
  if (tldElem === tabLogin.plainTld) {
    return tabLogin;
  }

  var tabTld = tabLogin.getPlainTabTld(); //= tabLogin.tabElement.getAttribute("multifox-tab-current-tld");
  if (tldElem === tabTld) {
    return tabLogin;
  }

  // tldElem != tabLogin.plainTld ==> is tldElem logged in?

  if (LoginDB.isTldLoggedIn(tldElem, tabLogin.encodedUser, tabLogin.encodedTld)) {
    return tabLogin;
  }

  // resource
  return tabLogin.toAnon();
}


function inheritFromPreviousTld(redirInvalidated, prevPrevTopTld, prevTopTld, requestTld, prevLogin) {
  if (redirInvalidated ||
     (prevPrevTopTld === null) || (prevTopTld === null) ||
     (prevLogin === null)      || (prevLogin.isLoggedIn === false)) {
    return false;
  }

  return (prevPrevTopTld === requestTld) &&
         (LoginDB.isLoggedIn(requestTld) === false) &&
          LoginDB.isLoggedIn(prevTopTld);
}


function checkEmptyPage(evt) { // DOMContentLoaded
  var contentDoc = evt.target;
  console.log("checkEmptyPage top =", contentDoc.defaultView === contentDoc.defaultView.top, contentDoc.location);
  if (isEmptyPage(contentDoc)) {
    return;
  }
  var tab = WindowParents.getTabElement(contentDoc.defaultView);
  tab.removeAttribute("multifox-cross-login-commited-wait-landing-page");
  tab.linkedBrowser.removeEventListener("DOMContentLoaded", checkEmptyPage, false);
}


// ugly workaround, but it works most of the time
var RedirDetector = {

  onMouseDown: function(evt) {
    // console.log("onmouse", evt.currentTarget, evt.originalTarget, evt.target.ownerDocument.location, evt.altKey, evt.ctrlKey, evt.keyCode, evt.charCode, evt.keyCode !== 0);
    if (evt.button === 0) {
      var win = evt.currentTarget;
      RedirDetector._invalidateSelectedTab(win);
    }
  },

  onKeyDown: function(evt) {
    // keypress--> charCode=0
    // console.log("onkey", evt.currentTarget, evt.originalTarget, evt.target.ownerDocument.location, evt.altKey, evt.ctrlKey, evt.keyCode, evt.charCode, evt.keyCode !== 0);
    var k = Ci.nsIDOMKeyEvent;
    //if (evt.altKey || evt.ctrlKey || (evt.keyCode !== 0) || (evt.charCode === k.DOM_VK_SPACE)) {
    if (evt.keyCode < 33) {
      // keyCode ==> backspace, enter
      // DOM_VK_SPACE ==> submit form
      var win = evt.currentTarget;
      RedirDetector._invalidateSelectedTab(win);
    }
  },

  _invalidateSelectedTab: function(win) {
    if (win === null) {
      return;
    }
    var tab = WindowParents.getTabElement(win);
    RedirDetector.invalidateTab(tab);
  },

  invalidateTab: function(tab) {
    if ((tab === null) || tab.hasAttribute("multifox-redir-invalidate")) {
      return;
    }

    tab.setAttribute("multifox-redir-invalidate", "true");
  },

  resetTab: function(tab) {
    tab.removeAttribute("multifox-redir-invalidate");
  }
};


var OpenerWindowIdentity = {
  findFromWindow: function(contentWin) {
    // popup via js/window.open?
    if (contentWin.opener) {
      var tabOpener = WindowParents.getTabElement(contentWin.opener);
      if (tabOpener) {
        return new TabLogin(tabOpener);
      }
    }

    //console.log("_getFromOpenerContent - no opener=" + contentWin.opener);

    // fx starting ==> opener=null
    return this.findFromOpenerSelectedTab(contentWin); // id from selected tab
  },


  findFromOpenerSelectedTab: function(contentWin) {
    var chromeWin = WindowParents.getChromeWindow(contentWin);
    if (chromeWin && chromeWin.opener) {
      var type = chromeWin.opener.document.documentElement.getAttribute("windowtype");
      if (type === "navigator:browser") {
        var selTab = chromeWin.opener.getBrowser().selectedTab;
        return new TabLogin(selTab);
      }
    }

    return null;
  }
};
