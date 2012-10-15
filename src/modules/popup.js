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
  panel.setAttribute("type", "arrow");

  var container = panel.appendChild(doc.createElement("vbox"));
  container.style.width = "50ch";

  var but = appendContent(container, panel);

  panel.addEventListener("popupshown", function(evt) {
    but.focus();
  }, false);

  panel.addEventListener("popuphidden", function(evt) {
    panel.parentNode.removeChild(panel);
  }, false);

  return panel;
}


function appendContent(container, panel) {
  var tab = UIUtils.getSelectedTab(container.ownerDocument.defaultView);
  var errorId = tab.getAttribute("multifox-tab-error");
  if (errorId.length === 0) {
    return null;
  }

  var ns = util.loadSubScript("${PATH_MODULE}/error.js");
  return ns.appendErrorToPanel(container, panel);
}


function createLoginsMenu(menupopup, onHidden) {
  menupopup.addEventListener("command", onLoginCommand, false);
  menupopup.addEventListener("click", onLoginMiddleClick, false);
  menupopup.addEventListener("popuphidden", function(evt) {
    if (evt.currentTarget === evt.target) { // bubbled event?
      onHidden();
      menupopup.removeEventListener("command", onLoginCommand, false);
      menupopup.parentNode.removeChild(menupopup);
    }
  }, false);


  var doc = menupopup.ownerDocument;
  var tabId = getIdFromTab(UIUtils.getSelectedTab(doc.defaultView));
  var docUser = WinMap.getUserFromTab(tabId);

  // list all accounts
  if (docUser !== null) {
    populateUsers(docUser, menupopup);
  }

  // new account
  var newAccount = menupopup.appendChild(doc.createElement("menuitem"));
  newAccount.setAttribute("label", util.getText("icon.user.new.label"));
  newAccount.setAttribute("accesskey", util.getText("icon.user.new.accesskey"));
  newAccount.setAttribute("cmd", "new account");
  if (docUser === null) {
    newAccount.setAttribute("disabled", "true"); // no top logins, 3rd-party only
  } else if (docUser.user.isNewAccount) {
    newAccount.setAttribute("image", "${PATH_CONTENT}/favicon.ico");
    newAccount.className = "menuitem-iconic";
  }

  // about
  menupopup.appendChild(doc.createElement("menuseparator"));
  var item4 = menupopup.appendChild(doc.createElement("menuitem"));
  item4.setAttribute("label", util.getText("icon.user.about.label", "${EXT_NAME}"));
  item4.setAttribute("accesskey", util.getText("icon.user.about.accesskey"));
  item4.setAttribute("cmd", "about");
}


function populateUsers(docUser, menupopup) {
  var users = LoginDB.getUsers(docUser);
  if (users.length === 0) {
    return;
  }

  var doc = menupopup.ownerDocument;

  for (var idx = users.length - 1; idx > -1; idx--) {
    var myUser = users[idx];

    if (docUser.user.equals(myUser)) {
      // current user
      var userMenu = menupopup.appendChild(doc.createElement("menu"));
      userMenu.className = "menu-iconic";
      userMenu.setAttribute("image", "${PATH_CONTENT}/favicon.ico");
      userMenu.setAttribute("label", myUser.plainName);
      if (myUser.encodedTld !== docUser.encodedDocTld) {
        userMenu.setAttribute("tooltiptext", myUser.plainTld);
      }
      var userPopup = userMenu.appendChild(doc.createElement("menupopup"));
      var delItem = userPopup.appendChild(doc.createElement("menuitem"));

      delItem.setAttribute("label", util.getText("icon.user.current.remove.label"));
      delItem.setAttribute("accesskey", util.getText("icon.user.current.remove.accesskey"));
      delItem.setAttribute("cmd", "del user");
      delItem.setAttribute("login-user16", myUser.encodedName);
      delItem.setAttribute("login-tld", myUser.encodedTld);

    } else {
      var usernameItem = menupopup.appendChild(doc.createElement("menuitem"));
      usernameItem.setAttribute("type", "radio");
      usernameItem.setAttribute("label", myUser.plainName);
      usernameItem.setAttribute("cmd", "switch user");
      usernameItem.setAttribute("login-user16", myUser.encodedName);
      usernameItem.setAttribute("login-tld", myUser.encodedTld);
      if (myUser.encodedTld !== docUser.encodedDocTld) {
        usernameItem.setAttribute("tooltiptext", myUser.plainTld);
      }
    }
  }

  menupopup.appendChild(doc.createElement("menuseparator"));
}


function onLoginMiddleClick(evt){
  if ((evt.button !== 1) || (evt.detail !== 1)) {
    // allow only middle clicks/single clicks
    return;
  }

  var menuItem = evt.target;
  switch (menuItem.getAttribute("cmd")) {
    case "switch user":
    case "new account":
      break;
    default:
      return;
  }

  if (menuItem.hasAttribute("disabled") && (menuItem.getAttribute("disabled") === "true")) {
    // ignore disabled items
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
  var tab = UIUtils.getSelectedTab(win);
  var uri = tab.linkedBrowser.currentURI;
  if (isSupportedScheme(uri.scheme) === false) {
    // Error page:
    // documentURI = about:neterror?e=netTimeout...
    // location    = http://twitter.com/
    return;
  }

  switch (menuItem.getAttribute("cmd")) {
    case "new account":
      var tabTld = getTldFromHost(uri.host);
      console.log("removeTldData_cookies", tabTld);
      removeTldData_cookies(tabTld);
      removeTldData_LS(tabTld);
      var docUser = WinMap.getUserFromTab(getIdFromTab(tab));
      loadTab(newTab, tab, new UserId(UserUtils.NewAccount, docUser.user.encodedTld));
      break;

    case "switch user":
      var encUser = menuItem.getAttribute("login-user16");
      var encTld = menuItem.getAttribute("login-tld");
      loadTab(newTab, tab, new UserId(encUser, encTld));
      break;

    case "del user":
      var encUser = menuItem.getAttribute("login-user16");
      var encTld = menuItem.getAttribute("login-tld");
      removeCookies(CookieUtils.getUserCookies(new UserId(encUser, encTld)));
      loadTab(newTab, tab, new UserId(UserUtils.NewAccount, encTld));
      break;

    case "about":
      openNewTab("about:multifox", win);
      break;

    default:
      console.trace();
      throw new Error("loginCommandCore:" + menuItem.getAttribute("cmd"));
  }
}


function loadTab(newTab, tab, user) {
  var browser = tab.linkedBrowser;
  var uri = browser.currentURI;
  var currentTabId = getIdFromTab(tab);
  var docUser = new DocumentUser(user, getTldFromHost(uri.host), currentTabId);

  if (newTab) {
    LoginDB.setDefaultUser(docUser.encodedDocTld, docUser.user); // BUG should twitpic set twitter as well?
    openNewTab(uri.spec, tab.ownerDocument.defaultView);
  } else {
    WinMap.setUserForTab(docUser, currentTabId);
    updateUIAsync(tab, true); // show new user now, don't wait for new dom
    // don't use browser.reload(), it would reload POST requests
    browser.loadURIWithFlags(uri.spec, Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
  }
}


function openNewTab(url, win) {
  var uri = Services.io.newURI(url, null, null);
  var where = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
  var win2 = win.browserDOMWindow.openURI(uri, null, where, 0); // TODO open tab at the right
}
