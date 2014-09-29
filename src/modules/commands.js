/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["windowCommand", "removeData", "getProfileListMenu"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils.import("resource://gre/modules/ShortcutUtils.jsm");
Components.utils.import("${PATH_MODULE}/new-window.js");
Components.utils.import("${PATH_MODULE}/main.js");


function windowCommand(evt, elem, cmd, param) {
  var win = elem.ownerDocument.defaultView.top;

  if (cmd === "cmd_show_error") {
    showError(win);
    return;
  }

  console.assert(PrivateBrowsingUtils.permanentPrivateBrowsing === false,
                 "permanentPrivateBrowsing unexpected");

  switch (cmd) {
    case "cmd_select_profile":
      var middleClick = evt.ctrlKey && (elem.localName !== "key");
      SelectProfile.parseProfileCmd(elem, middleClick);
      break;
    case "cmd_delete_profile":
      deleteCurrentPopup(win);
      break;
    case "cmd_delete_profile_prompt":
      showDeletePopup(win.document);
      break;
    case "cmd_rename_profile_prompt":
      renameProfilePrompt(win, Profile.toInt(param));
      break;
    case "cmd_select_tab":
      selectTab(Number.parseInt(param, 10));
      break;
    case "toggle-edit":
      evt.preventDefault();
      getProfileListMenu().toggleEdit(evt.target.ownerDocument);
      break;
    default:
      throw new Error("${EXT_NAME} - cmd unknown: " + cmd);
  }
}


function handleMiddleClick(evt) {
  if ((evt.button !== 1) || (evt.detail !== 1)) {
    // allow only middle clicks/single clicks
    return;
  }

  var button = evt.target;
  findParentPanel(button).hidePopup();
  SelectProfile.parseProfileCmd(button, true);
}


/*
| menu | click  | current tab    | selected profile |
===============================================================================
| main |  left  |  non-private   |   non-private    | reload tab (same id? select next)
| main |  left  |  non-private   |     private      | find priv win, open tab
| main |  left  |    private     |   non-private    | find non-priv win, open tab
| main |  left  |    private     |     private      | sel next tab

| main | middle |  non-private   |   non-private    | duplicate tab
| main | middle |  non-private   |     private      | find priv win, duplicate tab
| main | middle |    private     |   non-private    | find non-priv win, duplicate tab
| main | middle |    private     |     private      | duplicate tab

| link |  left  |  non-private   |   non-private    | open tab
| link |  left  |  non-private   |     private      | find priv win, open tab (DISABLED*)
| link |  left  |    private     |   non-private    | find non-priv win, open tab (DISABLED*)
| link |  left  |    private     |     private      | open tab

| link | middle |  non-private   |   non-private    | nop
| link | middle |  non-private   |     private      | nop
| link | middle |    private     |   non-private    | nop
| link | middle |    private     |     private      | nop

(*) disabled for history/bookmarks and links from private to non-private profiles.
    for links from, pages a window will be opened instead of a tab.
*/

var SelectProfile = {

  parseProfileCmd: function(elem, middleClick = false) {
    // elem = <key> or <toolbarbutton>
    var id = elem.hasAttribute("profile-id") ? elem.getAttribute("profile-id")
                                             : "";
    var newProfileId = id.length > 0 ? Profile.toInt(id)
                                     : Profile.lowerAvailableId();

    var win = elem.ownerDocument.defaultView.top;

    var priv = PrivateBrowsingUtils.isWindowPrivate(win) ? "tab-pvt    "
                                                         : "tab-non-pvt";
    var profile = newProfileId === Profile.PrivateIdentity ? "id-pvt"
                                                           : "id-non-pvt";
    var isToolbar = !elem.hasAttribute("cmd-context") // <key>
                 || (elem.getAttribute("cmd-context")
                     === ProfileListMenu.prototype.LocationToolbar);

    var cmdPos = isToolbar ? "main" : "link";
    var click = middleClick ? "middle" : "left  ";

    switch ([cmdPos, click, priv, profile].join(" ")) {
      case "main left   tab-non-pvt id-non-pvt":
        if (getCurrentProfile(win) !== newProfileId) {
          this._setTabProfile(win, newProfileId);
        } else {
          this._selectNextTab(win, newProfileId);
        }
        break;

      case "main middle tab-non-pvt id-non-pvt":
        queueNewProfile(newProfileId);
        this._openTabFromUrl(win, win);
        break;

      case "main middle tab-pvt     id-pvt":
        this._openTabFromUrl(win, win);
        break;

      case "main left   tab-pvt     id-pvt":
        this._selectNextTab(win, newProfileId);
        break;

      case "main left   tab-non-pvt id-pvt":
      case "main middle tab-non-pvt id-pvt":
        this._privateTabFromNormal(win, "tab");
        break;

      case "main left   tab-pvt     id-non-pvt":
      case "main middle tab-pvt     id-non-pvt":
        this._normalTabFromPvtWin(win, "tab", newProfileId);
        break;

      case "link left   tab-non-pvt id-non-pvt":
        queueNewProfile(newProfileId);
        this._openTabFromLink(win);
        break;

      case "link left   tab-pvt     id-pvt":
        this._openTabFromLink(win);
        break;

      case "link left   tab-non-pvt id-pvt":
        this._privateTabFromNormal(win, "link");
        break;

      case "link left   tab-pvt     id-non-pvt":
        this._normalTabFromPvtWin(win, "link", newProfileId);
        break;

      case "link middle tab-non-pvt id-pvt":
      case "link middle tab-non-pvt id-non-pvt":
      case "link middle tab-pvt     id-pvt":
      case "link middle tab-pvt     id-non-pvt":
      default:
        throw new Error("unexpected");
    }
  },


  _setTabProfile: function(win, profileId) {
    // profileId should be updated only when a new window is created.
    // (because code in unload may use the current profile)
    var browser = UIUtils.getSelectedTab(win).linkedBrowser;
    switch (browser.contentWindow.location.protocol) {
      case "http:":
      case "https:":
        queueNewProfile(profileId);
        this._reloadHttpTab(browser);
        break;
      default:
        // about: documents
        Profile.defineIdentity(browser, profileId);
        var winId = util.getOuterId(browser.ownerDocument.defaultView.top).toString();
        Services.obs.notifyObservers(null, "${BASE_DOM_ID}-id-changed", winId);
        break;
    }
  },


  _reloadHttpTab: function(browser) {
    var win = browser.contentWindow;
    var channel = win.QueryInterface(Ci.nsIInterfaceRequestor).
                        getInterface(Ci.nsIWebNavigation).
                          QueryInterface(Ci.nsIDocShell).
                            currentDocumentChannel.
                              QueryInterface(Ci.nsIHttpChannel);

    if (channel.requestMethod === "POST") {
      browser.loadURI(win.location.href); // avoid POST prompt
    } else {
      browser.reload();
    }
  },


  _openWindowFromUrl: function(win, isPrivate) {
    var browser = UIUtils.getSelectedTab(win).linkedBrowser;
    win.openLinkIn(browser.contentWindow.location.href,
                   "window",
                   {private: isPrivate});
  },


  _openWindowFromLink: function(win, isPrivate) {
    // page context menu
    if (win.gContextMenu) {
      // page
      if (isPrivate) {
        win.gContextMenu.openLinkInPrivateWindow();
      } else {
        // BUG openLinkIn always opens a private window if win is private
        win.gContextMenu.openLink();
      }
    // places context menu
    } else {
      if (isPrivate) {
        // BUG there is no way to open a private window from a link
        win.goDoPlacesCommand("placesCmd_open:window");
      } else {
        // BUG placesCmd_open:window always open a private
        // window from a private window
        win.goDoPlacesCommand("placesCmd_open:window");
      }
    }
  },


  _openTabFromUrl: function(srcWin, targetWin) {
    var browser = UIUtils.getSelectedTab(srcWin).linkedBrowser;
    targetWin.openUILinkIn(browser.contentWindow.location.href, "tab");
    targetWin.focus();
  },


  _openTabFromLink: function(win) {
    if (win.gContextMenu) {
      // page
      win.gContextMenu.openLinkInTab();
    } else {
      // bookmark/history
      win.goDoPlacesCommand("placesCmd_open:tab");
    }
  },


  _removeCurrentTab: function(win) {
    // TODO preserve history
    var tab = UIUtils.getSelectedTab(win);
    UIUtils.getContentContainer(win).removeTab(tab);
  },


  _privateTabFromNormal: function(win, urlSource) {
    switch (urlSource) {
      case "tab":
        var privWin = TabUtils.find1stWindow(true);
        if (privWin !== null) {
          this._openTabFromUrl(win, privWin);
        } else {
          this._openWindowFromUrl(win, true);
        }
        this._removeCurrentTab(win);
        break;
      case "link":
        // there is no easy way to add, from a link, a tab
        // in a different window. Open a window instead.
        this._openWindowFromLink(win, true);
        break;
    }
  },


  _normalTabFromPvtWin: function(privWin, urlSource, profileId) {
    queueNewProfile(profileId);
    switch (urlSource) {
      case "tab":
        var win = TabUtils.find1stWindow(false);
        if (win !== null) {
          this._openTabFromUrl(privWin, win);
        } else {
          this._openWindowFromUrl(privWin, false);
        }
        this._removeCurrentTab(privWin);
        break;
      case "link":
        // BUG windows from a private window are always private
        throw new Error("unexpected");
    }
  },


  _selectNextTab: function(win, newProfileId) {
    var allTabs = TabUtils.getTabs();

    var len = allTabs.length;
    var selectableTabs = new Array(len);
    var currentTab = UIUtils.getSelectedTab(win);
    var noTabs = true;
    var idxCurrent = -1;

    for (var idx = 0; idx < len; idx++) {
      var tab = allTabs[idx];
      var isCurrent = tab === currentTab;
      if (isCurrent) {
        idxCurrent = idx;
      }
      if (Profile.getIdentity(tab.linkedBrowser) === newProfileId) {
        if (isCurrent === false) {
          noTabs = false;
          selectableTabs[idx] = tab;
        }
      }
    }

    if (noTabs === false) {
      this._selectTab(selectableTabs, idxCurrent);
    }
  },


  _selectTab: function(selectableTabs, idxCurrent) {
    // there are tabs to select
    // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    //             last^
    //                  first^
    //                    ^idxCurrent (ignored)
    var len = selectableTabs.length;
    for (var idx = idxCurrent + 1, counter = 1; counter < len; idx++, counter++) {
      if (idx >= len) {
        idx = 0;
      }
      if (selectableTabs[idx] !== undefined) {
        var tab = selectableTabs[idx];
        var win = tab.ownerDocument.defaultView;
        UIUtils.getContentContainer(win).selectedTab = tab;
        win.focus();
        return;
      }
    }

    throw new Error("_selectTab");
  }

};


function selectTab(tabId) {
  var tab = getTabFromId(tabId);
  var win = tab.linkedBrowser.ownerDocument.defaultView;
  UIUtils.getContentContainer(win).selectedTab = tab;
  win.focus();
}


function getTabFromId(tabId) {
  var contentWin = Services.wm.getOuterWindowWithId(tabId);
  var browser = UIUtils.getContainerElement(contentWin);
  return UIUtils.getLinkedTabFromBrowser(browser);
}


var TabUtils = {

  find1stWindow: function(isPrivate) {
    for (var winId of this._getSortedWindows()) {
      var win = Services.wm.getOuterWindowWithId(winId);
      if (PrivateBrowsingUtils.isWindowPrivate(win) === isPrivate) {
        return win;
      }
    }
    return null;
  },


  getTabs: function() {
    var arr = [];
    for (var winId of this._getSortedWindows()) {
      var win = Services.wm.getOuterWindowWithId(winId);
      for (var tab of UIUtils.getTabList(win)) {
        arr.push(tab);
      }
    }
    return arr;
  },


  getTabsByProfile: function() {
    var rv = Object.create(null);
    for (var winId of this._getSortedWindows()) {
      var win = Services.wm.getOuterWindowWithId(winId);
      for (var tab of UIUtils.getTabList(win)) {
        var id = Profile.getIdentity(tab.linkedBrowser);
        if (id in rv) {
          rv[id].push(tab);
        } else {
          rv[id] = [tab];
        }
      }
    }
    return rv;
  },


  _getSortedWindows: function() {
    var arr = [];

    var enumWin = Services.wm.getEnumerator("navigator:browser");
    while (enumWin.hasMoreElements()) {
      arr.push(util.getOuterId(enumWin.getNext()));
    }

    arr.sort(function(a, b) {
      return a - b;
    });
    return arr;
  }
};


function getCurrentProfile(win) {
  return Profile.getIdentity(UIUtils.getSelectedTab(win).linkedBrowser);
}


function findParentPanel(elem) {
  var e = elem;
  while (e.localName !== "panel") {
    e = e.parentNode;
  }
  return e;
}


function formatCallCommand(...args) {
  return [
    "Components.utils.import('${PATH_MODULE}/commands.js',{})",
    ".windowCommand(event,this,'" + args.join("','") + "')"
  ].join("");
}


function renameProfilePrompt(win, profileId) {
  var title = "${EXT_NAME}";
  var desc = util.getText("dialog.rename2.label", ProfileAlias.format(profileId), profileId);
  var newName = {value: ProfileAlias.hasAlias(profileId)
                      ? ProfileAlias.format(profileId) : ""};
  if (Services.prompt.prompt(win, title, desc, newName, null, {value:false}) === false) {
    return;
  }

  ProfileAlias.rename(profileId, newName.value);

  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    var winId = util.getOuterId(enumWin.getNext()).toString();
    Services.obs.notifyObservers(null, "${BASE_DOM_ID}-id-changed", winId);
  }
}


function deleteCurrentPopup(win) {
  win.document.getElementById("${CHROME_NAME}-arrow-panel").hidePopup();

  var profileId = getCurrentProfile(win);

  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    for (var tab of UIUtils.getTabList(enumWin.getNext())) {
      if (Profile.getIdentity(tab.linkedBrowser) === profileId) {
        var tb = UIUtils.getContentContainer(tab.ownerDocument.defaultView);
        tb.removeTab(tab, {animate: true});
      }
    }
  }

  removeProfile(profileId);
  ProfileAlias.remove(profileId);
}


function showDeletePopup(doc) {
  var container = createArrowPanel(doc, "warning");

  var desc = container.appendChild(doc.createElement("description"));
  desc.appendChild(doc.createTextNode(util.getText("delete.text", "${EXT_NAME}")));

  var container2 = container.appendChild(doc.createElement("hbox"));
  container2.setAttribute("pack", "end");
  var but = container2.appendChild(doc.createElement("button"));
  but.setAttribute("label", util.getText("delete.button.label"));
  but.setAttribute("oncommand", formatCallCommand("cmd_delete_profile"));
}


function showError(win) {
  var doc = win.document;
  var container = createArrowPanel(doc, "error");

  var nodeDesc = container.appendChild(doc.createElement("vbox"));
  var nodeList = container.appendChild(doc.createElement("vbox"));
  var nodeDesc2 = container.appendChild(doc.createElement("vbox"));

  var msg;

  switch (ErrorHandler.getCurrentError(doc)) {
    case "incompatible-extension":
      ExtCompat.findIncompatibleExtensions(function(arr) {
        for (var idx = 0; idx < arr.length; idx++) {
          var desc = nodeList.appendChild(doc.createElement("description"));
          desc.setAttribute("style", "font-weight:bold");
          desc.appendChild(doc.createTextNode(arr[idx]));
        }
      });

      var nodeBottom = nodeDesc2.
                          appendChild(doc.createElement("hbox")).
                            appendChild(doc.createElement("description"));

      var textBottom = util.
                        getText("icon.error-panel.extension.bottom.label", "[${EXT_ID}]").
                          split("[${EXT_ID}]");

      nodeBottom.appendChild(doc.createTextNode(textBottom[0]));
      var nodeLink = nodeBottom.appendChild(doc.createElement("label"));
      nodeBottom.appendChild(doc.createTextNode(textBottom[1]));

      var linkText = util.getText("icon.error-panel.extension.bottom.link.label");
      nodeLink.appendChild(doc.createTextNode(linkText));
      nodeLink.classList.add("text-link");
      nodeLink.setAttribute("href", "${URL_CONTACT}");
      nodeLink.setAttribute("tooltiptext", "${URL_CONTACT}");

      msg = util.getText("icon.error-panel.extension.label", "${EXT_NAME}");
      break;
    case "www-authenticate":
    case "authorization":
      msg = util.getText("icon.error-panel.unsupported-feature.label", "${EXT_NAME}", "HTTP Basic authentication");
      break;
    case "indexedDB":
      msg = util.getText("icon.error-panel.unsupported-feature.label", "${EXT_NAME}", "indexedDB");
      break;
    case "sandbox":
      msg = util.getText("icon.error-panel.sandbox.label", "${EXT_NAME}");
      break;
    default:
      if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
        msg = util.getText("icon.error-panel.permanent-private.label", "${EXT_NAME}");
      } else {
        msg = ErrorHandler.getCurrentError(doc);
      }
      break;
  }

  nodeDesc.
    appendChild(doc.createElement("description")).
      appendChild(doc.createTextNode(msg));
}


function createArrowPanel(doc, icon) {
  console.assert(doc.getElementById("${CHROME_NAME}-arrow-panel") === null, "dupe panel");

  var fragment = doc.createDocumentFragment();
  var panel = fragment.appendChild(doc.createElement("panel"));
  panel.setAttribute("id", "${CHROME_NAME}-arrow-panel");
  panel.setAttribute("type", "arrow");

  var container = panel.appendChild(doc.createElement("hbox"));
  var col1 = container.appendChild(doc.createElement("vbox"));
  var img = col1.appendChild(doc.createElement("image"));
  switch (icon) {
    case "warning":
      img.setAttribute("src", "chrome://global/skin/icons/warning-large.png"); // 48px
      break;
    case "error":
      // BUG OS X 404 "chrome://global/skin/icons/error-48.png"
      img.setAttribute("src", "chrome://global/skin/icons/error-64.png");
      break;
    default:
      throw new Error("createArrowPanel", icon);
  }

  var col2 = container.appendChild(doc.createElement("vbox"));
  col2.setAttribute("flex", "1");
  col2.setAttribute("style", "margin:.5ch .5ch; width:40ch");


  var button;
  var placement = Components.utils.import("resource:///modules/CustomizableUI.jsm", {})
                 .CustomizableUI.getPlacementOfWidget("${CHROME_NAME}-button");
  if ((placement === null) || (placement.area === "PanelUI-contents")) {
    button = doc.getElementById("PanelUI-button");
  } else {
    button = doc.getElementById("${CHROME_NAME}-button");
  }

  panel.addEventListener("popuphidden", function(evt) {
    var myPanel = evt.target;
    console.assert(myPanel.localName === "panel", "myPanel should be a panel element", myPanel);
    myPanel.parentNode.removeChild(myPanel);
  }, false);

  doc.getElementById("mainPopupSet").appendChild(fragment);
  panel.openPopup(button, "bottomcenter topright");
  return col2;
}


function removeData() {
  // TODO localStorage
  // cookies
  var list = Profile.getProfileList();
  for (var idx = list.length - 1; idx > -1; idx--) {
    removeProfile(list[idx]);
  }

  // remove error attributes
  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    var tabbrowser = enumWin.getNext().getBrowser();
    for (idx = tabbrowser.length - 1; idx > -1; idx--) {
      var browser = tabbrowser.browsers[idx];
      browser.removeAttribute("multifox-tab-error-script");
      browser.removeAttribute("multifox-tab-error-net");
    }
  }
}


function removeProfile(profileId) {
  console.assert(Profile.isExtensionProfile(profileId), "cannot remove native profile", profileId);

  var h = "-" + profileId + ".multifox";
  var myCookies = [];
  var COOKIE = Ci.nsICookie2;
  var mgr = Services.cookies;
  var all = mgr.enumerator;

  while (all.hasMoreElements()) {
    var cookie = all.getNext().QueryInterface(COOKIE);
    if (cookie.host.endsWith(h)) {
      myCookies.push(cookie);
    }
  }

  for (var idx = myCookies.length - 1; idx > -1; idx--) {
    cookie = myCookies[idx];
    mgr.remove(cookie.host, cookie.name, cookie.path, false);
  }
}


function getProfileListMenu() {
  return new ProfileListMenu();
}


function ProfileListMenu() {
}


ProfileListMenu.prototype = {

  LocationToolbar: "toolbar",
  LocationPlaces:  "places",
  LocationLink:    "link",

  _init: function(doc, location) {
    this._location = location;
    this._currentProfile = getCurrentProfile(doc.defaultView.top);
  },


  renderLinkMenu: function(fragment, isPlacesMenu = false) {
    this._init(fragment.ownerDocument, isPlacesMenu ? this.LocationPlaces
                                                    : this.LocationLink);
    this._panelList(fragment);
  },


  // <panelview>
  //   <label value="Multifox"/>
  //   <deck>
  //     <vbox> // menu
  //     <vbox> // edit
  renderToolbarMenu: function(doc) {
    this._init(doc, "toolbar");

    var fragmentMenu = doc.createDocumentFragment();
    this._panelList(fragmentMenu);

    var panelView = doc.getElementById("${CHROME_NAME}-view-panel");

    var h = panelView.appendChild(doc.createElement("label"));
    h.classList.add("panel-subview-header");
    h.setAttribute("value", "${EXT_NAME}");


    var deck = panelView.appendChild(doc.createElement("deck"));
    deck.setAttribute("id", "${CHROME_NAME}-view-deck");
    deck.setAttribute("flex", "1"); // panel won't shrink
    deck.setAttribute("style", "min-width:35ch");
    deck.selectedIndex = "0";

    var ph = deck.appendChild(doc.createElement("vbox"));
    ph.addEventListener("click", handleMiddleClick);
    ph.classList.add("panel-subview-body");
    ph.appendChild(fragmentMenu);

    var ph = deck.appendChild(doc.createElement("vbox"));
    ph.setAttribute("id", "${CHROME_NAME}-view-edit");
    ph.classList.add("panel-subview-body");
  },


  toggleEdit: function(doc) {
    this._init(doc, "toolbar");

    var ph = doc.getElementById("${CHROME_NAME}-view-edit");
    var deck = doc.getElementById("${CHROME_NAME}-view-deck");
    if (deck.selectedIndex === "1") {
      deck.selectedIndex =  "0";
      util.emptyNode(ph);
    } else {
      deck.selectedIndex = "1";
      var fragmentEdit = doc.createDocumentFragment();
      this._panelEdit(fragmentEdit);
      ph.appendChild(fragmentEdit);
    }
  },


  _panelList: function(fragment) {
    // New
    this._appendNew(fragment);
    this._appendSeparator(fragment);

    // Default
    this._appendMenuItem(fragment, Profile.DefaultIdentity);

    // Private
    var item = this._appendButton(fragment, ProfileAlias.format(Profile.PrivateIdentity));
    this._disableDueToBug(true, item);
    item.setAttribute("oncommand", formatCallCommand("cmd_select_profile"));
    item.setAttribute("profile-id", Profile.PrivateIdentity);
    item.setAttribute("cmd-context", this._location);

    if (PrivateBrowsingUtils.isWindowPrivate(fragment.ownerDocument.defaultView.top)) {
      item.setAttribute("type", "radio");
      item.setAttribute("checked", "true");
    }

    // User profiles
    var list = ProfileAlias.sort(Profile.getProfileList());
    if (list.length > 0) {
      this._appendSeparator(fragment);
      for (var idx = 0; idx < list.length; idx++) {
        this._appendMenuItem(fragment, list[idx]);
      }
    }

    if (this._location !== this.LocationToolbar) {
      return;
    }

    // Show error
    var doc = fragment.ownerDocument;
    if (PrivateBrowsingUtils.permanentPrivateBrowsing ||
       (ErrorHandler.getCurrentError(doc).length > 0)) {
      this._appendSeparator(fragment);
      var item = this._appendButton(fragment, util.getText("button.menuitem.error.label"));
      item.setAttribute("image", "chrome://global/skin/icons/error-16.png");
      item.setAttribute("oncommand", formatCallCommand("cmd_show_error"));
    }
  },


  _appendNew: function(fragment) {
    var item = this._appendButton(fragment, util.getText("button.menuitem.new.label"));
    this._disableDueToBug(false, item);
    item.setAttribute("oncommand", formatCallCommand("cmd_select_profile"));
    item.setAttribute("cmd-context", this._location);
    if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
      item.setAttribute("disabled", "true");
    }
    if (this._location !== this.LocationToolbar) {
      return;
    }
    var keyId = "key_${BASE_DOM_ID}-new-identity";
    var key = fragment.ownerDocument.getElementById(keyId);
    item.setAttribute("key", keyId);
    item.setAttribute("shortcut", ShortcutUtils.prettifyShortcut(key));
  },


  _appendMenuItem: function(fragment, id) {
    var name = ProfileAlias.format(id);
    if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
      this._appendButton(fragment, name).setAttribute("disabled", "true");
      return;
    }

    var cmd = formatCallCommand("cmd_select_profile");

    // not the current profile
    if (id !== this._currentProfile) {
      var item = this._appendButton(fragment, name);
      this._disableDueToBug(false, item);
      item.setAttribute("oncommand", cmd);
      item.setAttribute("profile-id", id);
      item.setAttribute("cmd-context", this._location);
      return;
    }

    // current profile
    var items = fragment.appendChild(fragment.ownerDocument.createElement("toolbaritem"));

    var item = this._appendButton(items, name);
    item.setAttribute("type", "radio");
    item.setAttribute("checked", "true");
    item.setAttribute("flex", "1");
    item.setAttribute("oncommand", cmd);
    item.setAttribute("profile-id", id);
    item.setAttribute("cmd-context", this._location);

    // [Edit]
    if (this._location === this.LocationToolbar) {
      this._appendButton(items, util.getText("button.menuitem.edit.label"))
        .setAttribute("onclick", formatCallCommand("toggle-edit"));
    }
  },


  _panelEdit: function(fragment) {
    var item;

    // Back
    item = this._appendButton(fragment, util.getText("button.back.label"));
    item.setAttribute("onclick", formatCallCommand("toggle-edit"));

    // Rename
    var currentId = this._currentProfile;
    this._appendSeparator(fragment);
    item = this._appendButton(fragment, util.getText("button.menuitem.rename2.label"));
    item.setAttribute("oncommand", formatCallCommand("cmd_rename_profile_prompt", currentId));

    // Delete
    item = this._appendButton(fragment, util.getText("button.menuitem.delete2.label"));
    item.setAttribute("oncommand", formatCallCommand("cmd_delete_profile_prompt", currentId));
    if (Profile.isExtensionProfile(currentId) === false) {
      item.setAttribute("disabled", "true");
    }

    if (this._currentProfile === Profile.PrivateIdentity) {
      return;
    }

    // List tabs
    var tabs = TabUtils.getTabsByProfile();
    if (this._currentProfile in tabs) {
      this._listTabs(fragment, tabs[this._currentProfile]);
    }
  },


  _listTabs: function(fragment, list) {
    this._appendSeparator(fragment);

    var currentTab = UIUtils.getSelectedTab(fragment.ownerDocument.defaultView);

    for (var idx = 0; idx < list.length; idx++) {
      var tab = list[idx];
      var item = this._appendButton(fragment, tab.label);
      if (tab.image) {
        item.setAttribute("image", "moz-anno:favicon:" + tab.image);
      }

      var contentWin = tab.linkedBrowser.contentWindow;
      item.setAttribute("tooltiptext", tab.label + "\n" + contentWin.location.href);

      if (currentTab !== tab) {
        var tabId = util.getOuterId(contentWin).toString();
        item.setAttribute("oncommand", formatCallCommand("cmd_select_tab", tabId));
      } else {
        item.setAttribute("type", "checkbox");
        item.setAttribute("checked", "true");
        item.setAttribute("selected", "true");
      }
    }
  },


  // disable command (see SelectProfile comments)
  _disableDueToBug: function(idIsPrivate, item) {
    var tabPrivate = this._currentProfile === Profile.PrivateIdentity
                   ? "tab-priv" : "tab-non-priv";

    var profile = idIsPrivate ? "id-pvt" : "id-non-pvt";

    switch ([this._location, tabPrivate, profile].join(" ")) {
      case "places tab-priv id-non-pvt":
      case "places tab-non-priv id-pvt":
      case "link tab-priv id-non-pvt":
        item.setAttribute("disabled", "true");
        break;
    }
  },


  _appendButton: function(node, label) {
    var isToolbar = this._location === this.LocationToolbar;
    var name = isToolbar ? "toolbarbutton" : "menuitem";
    var elem = node.appendChild(node.ownerDocument.createElement(name));
    elem.setAttribute("label", label);
    if (isToolbar) {
      elem.classList.add("subviewbutton");
    }
    return elem;
  },


  _appendSeparator: function(node) {
    var isToolbar = this._location === this.LocationToolbar;
    var name = isToolbar ? "toolbarseparator" : "menuseparator";
    node.appendChild(node.ownerDocument.createElement(name));
  }

};
