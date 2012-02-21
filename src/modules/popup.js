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

"use strict";

Components.utils.import("${PATH_MODULE}/new-window.js");

function createMsgPanel(doc) {
  var panel = doc.getElementById("multifox-popup");
  if (panel) {
    //bug
    console.trace("createMsgPanel dup popup " + panel.state);
    panel.hidePopup();
    return panel;
  }

  panel = doc.getElementById("mainPopupSet").appendChild(doc.createElement("panel"));
  panel.setAttribute("id", "multifox-popup");
  var fx36 = is192();
  if (!fx36) {
    panel.setAttribute("type", "arrow");
  }

  var container = panel.appendChild(doc.createElement("vbox"));
  container.style.width = "50ch";

  var but = appendContent(container, panel);

  panel.addEventListener("popupshowing", function(evt) {
    if (fx36) {
      copyCss(doc.getElementById("editBookmarkPanel"), panel);
      if (but) {
        copyButtonCss(doc, but);
      }
    }
  }, false);

  panel.addEventListener("popupshown", function(evt) {
    but.focus();
  }, false);

  panel.addEventListener("popuphidden", function(evt) {
    panel.parentNode.removeChild(panel);
  }, false);

  return panel;
}


function appendContent(container, panel) {
  var tab = container.ownerDocument.defaultView.getBrowser().selectedTab;
  var errorId = tab.getAttribute("multifox-tab-error");
  if (errorId.length === 0) {
    return null;
  }

  var ns = {};
  var subscript = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
  subscript.loadSubScript("${PATH_MODULE}/error.js", ns);
  return ns.appendErrorToPanel(container, panel, errorId);
}


function copyButtonCss(doc, toBut) {
  var srcBut = doc.getElementById("editBookmarkPanelDoneButton");
  copyCss(srcBut, toBut);
  doc.defaultView.setTimeout(function() {
    // wait xbl
    var source = doc.getAnonymousElementByAttribute(srcBut, "class", "box-inherit button-box");
    var target = doc.getAnonymousElementByAttribute(toBut,  "class", "box-inherit button-box");
    target.setAttribute("style",""); // BUG Error: target is null
    copyCss(source, target);
  }, 0);
}


function copyCss(source, target) {
  var win = source.ownerDocument.defaultView;
  var style1 = win.getComputedStyle(source, "");
  var style2 = target.style;

  for (var name in style1) {
    if (style1[name]) {
      switch (name) {
        case "length":
        case "parentRule":
        case "display":
          continue;
      }
      if (name.indexOf("padding") === 0) {
        continue;
      }
      style2[name] = style1[name];
    }
  }
}


function is192() {
  var info = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
  return info.platformVersion.indexOf("1.9") === 0; // Gecko 1.9.2
}


function createLoginsMenu(menupopup, onHidden) {
  menupopup.addEventListener("command", onLoginCommand, false);
  menupopup.addEventListener("click", onLoginClick, false);
  menupopup.addEventListener("popuphidden", function(evt) {
    if (evt.currentTarget === evt.target) { // bubbled event?
      onHidden();
      menupopup.removeEventListener("command", onLoginCommand, false);
      menupopup.parentNode.removeChild(menupopup);
    }
  }, false);


  var doc = menupopup.ownerDocument;
  var tab = doc.defaultView.getBrowser().selectedTab;
  var tabLogin = new TabLogin(tab);

  // list all accounts
  populateUsers(tabLogin, menupopup);

  // new account
  var newAccount = menupopup.appendChild(doc.createElement("menuitem"));
  newAccount.setAttribute("label", util.getText("icon.user.new.label"));
  newAccount.setAttribute("accesskey", util.getText("icon.user.new.accesskey"));
  newAccount.setAttribute("cmd", "new account");
  if (tabLogin.isNewUser) {
    newAccount.className = "menuitem-iconic";
    newAccount.setAttribute("image", "${PATH_CONTENT}/favicon.ico");
  }

  // about
  menupopup.appendChild(doc.createElement("menuseparator"));
  var item4 = menupopup.appendChild(doc.createElement("menuitem"));
  item4.setAttribute("label", util.getText("icon.user.about.label", "${EXT_NAME}"));
  item4.setAttribute("accesskey", util.getText("icon.user.about.accesskey"));
  item4.setAttribute("cmd", "about");
}


function populateUsers(tabLogin, menupopup) {
  var users = LoginDB.getEncodedTldUsers(tabLogin.getEncodedTabTld());
  if (users.length === 0) {
    return;
  }

  var doc = menupopup.ownerDocument;

  for (var idx = users.length - 1; idx > -1; idx--) {
    var myUser = users[idx];

    if ((tabLogin.encodedUser === myUser.encodedLoginUser) && (tabLogin.encodedTld === myUser.encodedLoginTld)) {
      // current user
      var userMenu = menupopup.appendChild(doc.createElement("menu"));
      userMenu.className = "menu-iconic";
      userMenu.setAttribute("image", "${PATH_CONTENT}/favicon.ico");
      userMenu.setAttribute("label", myUser.plainLoginUser);
      if (myUser.encodedLoginTld !== tabLogin.getEncodedTabTld()) {
        userMenu.setAttribute("tooltiptext", StringEncoding.decode(myUser.encodedLoginTld));
      }
      var userPopup = userMenu.appendChild(doc.createElement("menupopup"));
      var delItem = userPopup.appendChild(doc.createElement("menuitem"));

      delItem.setAttribute("label", util.getText("icon.user.current.remove.label"));
      delItem.setAttribute("accesskey", util.getText("icon.user.current.remove.accesskey"));
      delItem.setAttribute("cmd", "del user");
      delItem.setAttribute("login-user16", myUser.encodedLoginUser);
      delItem.setAttribute("login-tld", myUser.encodedLoginTld);

    } else {
      var usernameItem = menupopup.appendChild(doc.createElement("menuitem"));
      usernameItem.setAttribute("type", "radio");
      usernameItem.setAttribute("label", myUser.plainLoginUser);
      usernameItem.setAttribute("cmd", "switch user");
      usernameItem.setAttribute("login-user16", myUser.encodedLoginUser);
      usernameItem.setAttribute("login-tld", myUser.encodedLoginTld);
      if (myUser.encodedLoginTld !== tabLogin.getEncodedTabTld()) {
        usernameItem.setAttribute("tooltiptext", StringEncoding.decode(myUser.encodedLoginTld));
      }
    }
  }

  menupopup.appendChild(doc.createElement("menuseparator"));
}


function onLoginClick(evt){
  if ((evt.button !== 1) || (evt.detail !== 1)) {
    return;
  }

  var menuItem = evt.target;
  if (menuItem.hasAttribute("disabled") && (menuItem.getAttribute("disabled") === "true")) {
    return;
  }

  menuItem.parentNode.hidePopup();
  loginCommandCore(menuItem, true);
}


function onLoginCommand(evt){
  loginCommandCore(evt.target, evt.ctrlKey);
}


function loginCommandCore(menuItem, newTab) {
  var win = menuItem.ownerDocument.defaultView;
  var tab = win.getBrowser().selectedTab;
  var uri = tab.linkedBrowser.contentDocument.documentURIObject;
  if (isSupportedScheme(uri.scheme) === false) {
    // Error page:
    // documentURI = about:neterror?e=netTimeout...
    // location    = http://twitter.com/
    return;
  }

  var tabTld = getTldFromHost(uri.host);

  switch (menuItem.getAttribute("cmd")) {
    case "new account":
      console.log("removeTldData_cookies", tabTld);
      removeTldData_cookies(tabTld);
      removeTldData_LS(tabTld);
      loadTab(newTab, tab, TabLoginHelper.NewAccount, new TabLogin(tab).encodedTld);
      break;

    case "switch user":
      var encUser = menuItem.getAttribute("login-user16");
      var encTld = menuItem.getAttribute("login-tld");
      loadTab(newTab, tab, encUser, encTld);
      break;

    case "del user":
      var encUser = menuItem.getAttribute("login-user16");
      var encTld = menuItem.getAttribute("login-tld");
      removeCookies(CookieUtils.getUserCookies(encUser, encTld));
      loadTab(newTab, tab, TabLoginHelper.NewAccount, encTld);
      break;

    case "about":
      openNewTab("about:multifox", win);
      break;

    default:
      console.trace();
      throw new Error("loginCommandCore:" + menuItem.getAttribute("cmd"));
  }
}


function loadTab(newTab, tab, encUser, encTld) {
  var tabLogin = TabLoginHelper.create(tab, encUser, encTld);
  var browser = tab.linkedBrowser;
  var url = browser.contentDocument.location.href;

  if (newTab) {
    LoginDB.setDefaultLogin(tabLogin.getEncodedTabTld(), encUser, encTld);
    openNewTab(url, tab.ownerDocument.defaultView);
  } else {
    tabLogin.saveToTab();
    updateUI(tab, true);
    // don't use browser.reload(), it would reload POST requests
    browser.loadURIWithFlags(url, Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
  }
}


function openNewTab(url, win) {
  var io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  var uri = io.newURI(url, null, null);
  var where = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
  var win2 = win.browserDOMWindow.openURI(uri, null, where, 0); // TODO open tab at the right
}
