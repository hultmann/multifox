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
 * Portions created by the Initial Developer are Copyright (C) 2009
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


var m_welcomeMode = false;

function setWelcomeMode(enable) {
  if (m_welcomeMode === enable) {
    return;
  }

  m_welcomeMode = enable; // TODO check tabs with login attr

  var winEnum = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getEnumerator("navigator:browser");
  while (winEnum.hasMoreElements()) {
    var win = winEnum.getNext();
    var tab = win.getBrowser().selectedTab;
    updateUI(tab, true);
    if (enable) {
      getIconContainer(win.document).setAttribute("current-error", "welcome"); // force updateStatIcon
    }
  }
}


function updateUI(tab, force) { // force = optional param
try {
  if (tab.hasAttribute("selected") === false) {
    return;
  }

  if (tab.hasAttribute("multifox-invalidate-icon")) {
    tab.removeAttribute("multifox-invalidate-icon");
  } else {
    if (force !== true) {
      return;
    }
  }

  var doc = tab.ownerDocument;
  var container = getIconContainer(doc);

  if ((tab.hasAttribute("multifox-tab-id-provider-tld-enc") === false) && (m_welcomeMode === false)) {
    // remove box
    if (container !== null) {
      container.parentNode.removeChild(container);
    }
    return;
  }

  if (container === null) {
    createContainer(doc);
    var win = doc.defaultView;
    var delay = getTabNodes(win.getBrowser()).length > 1 ? 25 : 200;
    win.setTimeout(initIcon, delay, doc); // open window => greater delay
  } else {
    LoginDB.setTabAsDefaultLogin(tab); // TODO it will call _ensureValid, make sure we don't block TabSelect
    if (container.firstChild !== null) { // waiting initIcon?
      updateIconCore(tab, container);
    }
  }

} catch (ex) {
console.error(ex);
}
}



// <hbox align="center" id="multifox-icon">
//   <box>
//     <hbox align="center">
//       <hbox id="multifox-icon-stat-icon">
//         <image src="warning.png"/>
//       </hbox>
//       <label value="username"/>
//     </hbox>
//   </box>
// </hbox>


function createContainer(doc) {
  var container = getIconContainer(doc);
  if (container === null) {
    var ref = doc.getElementById("urlbar-icons");
    container = ref.insertBefore(doc.createElement("hbox"), ref.firstChild);
    container.setAttribute("hidden", "true");
    container.setAttribute("id", "multifox-icon");
    container.setAttribute("align", "center");
  }
  return container;
}


function createBoxDom(container) {
  var doc = container.ownerDocument;
  var container2 = container.appendChild(doc.createElement("box"));
  var container3 = container2.appendChild(doc.createElement("hbox"));
  var stat = container3.appendChild(doc.createElement("hbox"));
  var label = container3.appendChild(doc.createElement("label"));

  container2.setAttribute("tooltiptext", "${EXT_NAME}");
  container3.setAttribute("align", "center");
  stat.setAttribute("hidden", "true");
  stat.setAttribute("id", "multifox-icon-stat-icon");

  // max-width
  container3.style.maxWidth = "20ch"; // TODO util.getText("icon.user.maxWidth");
  label.setAttribute("crop", "end");
  label.setAttribute("flex", "1");
}


function setStyleCore(container, doc) {
  container.minHeight = "16px";
  container.overflow = "hidden";
  container.padding = "0";
  container.margin = "0 2px 0 1px";
  container.border = "1px solid #ccc";
  container.borderRadius = "2px";
  container.opacity = "1";
  container.MozTransition = "";

  var styleLabel = getIconLabel(doc).style;
  styleLabel.padding = "0px 6px";
  styleLabel.margin = "-1px 0px";
  styleLabel.color = "#777";
}


function setStyle(mode, containerStyle, iconStyle, labelStyle) {
  switch (mode) {
    case "default":
      containerStyle.backgroundImage = "-moz-linear-gradient(hsl(214,44%,99%), hsl(214,44%,87%))";
      labelStyle.textShadow = "0 1px 0 white";
      iconStyle.opacity = "1";
      break;
    case "hover":
      containerStyle.backgroundImage = "-moz-linear-gradient(hsl(214,44%,80%), hsl(214,44%,60%))";//#fff, #eee)";
      iconStyle.opacity = "1";
      labelStyle.textShadow = "0 1px 0 white, 0 1px 5px white, 3px 0 5px white, 0 -1px 5px white, -3px 0 5px white";
      break;
    case "active":
      containerStyle.backgroundImage = "-moz-linear-gradient(#ddd, #999)";
      iconStyle.opacity = ".5";
      labelStyle.textShadow = "0 1px 0 white, 0 1px 5px white, 3px 0 5px white, 0 -1px 5px white, -3px 0 5px white";
      break;
    default:
      throw new Error("setColor");
  }
}


function invalidateUI(tab) {
  if (tab.hasAttribute("selected")) {
    tab.setAttribute("multifox-invalidate-icon", "true");
  }
}


function updateIconCore(tab, container) {
  if (m_welcomeMode) {
    var doc = tab.ownerDocument;
    getIconLabel(doc).setAttribute("value", "${EXT_NAME}");
    updateStatIcon3(true, getStatIconContainer(doc), "${PATH_CONTENT}/favicon.ico");
  } else {
    updateStatIcon(tab, container);
    updateIconUserName(tab);
  }
}


function updateIconUserName(tab) {
  var tabLogin = new TabLogin(tab);
  var user;
  if (tabLogin.isNewUser) {
    user = util.getText("icon.add-account.label");
  } else {
    user = tabLogin.plainUser; // BUG sometimes is null
  }

  getIconLabel(tab.ownerDocument).setAttribute("value", user);
}


function updateStatIcon(tab, container) {
  var currentError = container.hasAttribute("current-error") ? container.getAttribute("current-error") : "";
  var newError = tab.hasAttribute("multifox-tab-error") ? tab.getAttribute("multifox-tab-error") : "";
  if (currentError !== newError) {
    container.setAttribute("current-error", newError);
    var statIcon = getStatIconContainer(tab.ownerDocument);
    updateStatIcon3(newError.length > 0, statIcon, "chrome://global/skin/icons/warning-16.png"); // ubuntu: 22x22
  }
}


function updateStatIcon3(show, statIcon, url) {
  if (statIcon.firstChild) {
    statIcon.removeChild(statIcon.firstChild);
  }
  if (show) {
    var doc = statIcon.ownerDocument;
    var img = statIcon.appendChild(doc.createElement("image"));
    img.setAttribute("src", url);
    img.setAttribute("width", "16");
    img.setAttribute("height", "16");
    img.style.margin = "0 -4px 0 6px"; // marginleft = same as getIconLabel(doc).style.padding
    statIcon.removeAttribute("hidden");
  } else {
    statIcon.setAttribute("hidden", "true");
  }
}


function getIconContainer(doc) {
  return doc.getElementById("multifox-icon");
}


function getIconLabel(doc) {
  var node = getIconContainer(doc); // TODO params should be container instead of doc
  console.assert(node !== null, "getIconContainer=null");
  //console.assert(node.firstChild.firstChild !== null, "node.firstChild.firstChild=null");
  return node.firstChild.firstChild.children[1];
}


function getStatIconContainer(doc) {
  return doc.getElementById("multifox-icon-stat-icon");
}


function initIcon(doc) {
  var tab = doc.defaultView.getBrowser().selectedTab;
  LoginDB.setTabAsDefaultLogin(tab);

  var container = getIconContainer(doc);
  if (container === null) {
    // e.g. user changed tab!
    console.log("initIcon ignored! " + container);
    return;
  }

  console.assert(container.children.length === 0, "container has children");
  createBoxDom(container);
  setStyleCore(container.style, doc);

  if (tab.hasAttribute("multifox-logging-in")) {
    tab.removeAttribute("multifox-logging-in");
    container.style.opacity = "0";
    container.style.MozTransition = "opacity .3s ease";
    doc.defaultView.setTimeout(function() {
      container.style.opacity = "1";
    }, 50);
  }

  initIconNormal(doc);
  updateIconCore(tab, container);
  container.removeAttribute("hidden");
}



function initIconNormal(doc) {
  var statIcon = getStatIconContainer(doc);
  var container = getIconContainer(doc);
  var lab = getIconLabel(doc).style;

  doc.defaultView.setTimeout(function() {
    // workaround
    // otherwise, mousedown on icon will close and open popup, even with stopPropagation
    statIcon.addEventListener("mousedown", showMsgPanel, false);
    container.addEventListener("mousedown", showMenuPopup, false);
  }, 0);
  container.addEventListener("mouseover", onIconHover, false);
  container.addEventListener("mouseout", onIconHover, false);

  //statIcon.style.opacity = "1";
  setStyle("default", container.style, statIcon.style, lab);
  //lab.opacity = "1";
  //defaultStyle(container.style, lab);
}


function initIconPressed(doc, popupId) {
  var container = getIconContainer(doc);
  container.removeEventListener("mouseover", onIconHover, false);
  container.removeEventListener("mouseout", onIconHover, false);

  var statIcon = getStatIconContainer(doc);
  var lab = getIconLabel(doc).style;
  statIcon.removeEventListener("mousedown", showMsgPanel, false);
  switch (popupId) {
    case "menu":
      setStyle("active", container.style, statIcon.style, lab);
      break;
    case "msg":
      lab.opacity = ".5";
      break;
  }
}


function onIconHover(evt) {
  var doc = evt.target.ownerDocument;
  var container = getIconContainer(doc);
  setStyle(
    evt.type === "mouseover" ? "hover" : "default",
    container.style,
    getStatIconContainer(doc).style,
    getIconLabel(doc).style);
}


function isMsgPopup(evt) {
  return evt.target.localName === "image";
}


function showMsgPanel(evt) {
  if (isMsgPopup(evt) === false) {
    return;
  }

  var doc = evt.target.ownerDocument;
  initIconPressed(doc, "msg");

  var ns = loadSubScript("${PATH_MODULE}/popup.js");
  var panel = ns.createMsgPanel(doc);

  panel.addEventListener("popuphidden", function(evt) {
    initIconNormal(doc);
    // remove error msg
    var tab = doc.defaultView.getBrowser().selectedTab;
    tab.removeAttribute("multifox-tab-error");
    updateUI(tab, true);
  }, false);

  panel.openPopup(getStatIconContainer(doc), "bottomcenter topleft", 5, 0); // due to img.style.margin
}


function showMenuPopup(evt) {
  if ((evt.button !== 0) || (evt.detail !== 1)) {
    // allow only left clicks
    return;
  }

  var doc = evt.target.ownerDocument;
  var container = getIconContainer(doc);

  if (m_welcomeMode) {
    var ns = loadSubScript("${PATH_MODULE}/welcome.js");
    var panel = ns.welcomePopup(doc);
    panel.openPopup(container, "bottomcenter topright");
    return;
  }

  if (isMsgPopup(evt)) {
    return;
  }

  initIconPressed(doc, "menu");
  var menu = doc.getElementById("mainPopupSet").appendChild(doc.createElement("menupopup"));
  var ns = loadSubScript("${PATH_MODULE}/popup.js");
  ns.createLoginsMenu(menu, function() {initIconNormal(doc);});
  menu.openPopup(container, "after_end", 0, 1);
}


function loadSubScript(path) {
  var ns = {};
  var sub = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
  sub.loadSubScript(path, ns);
  return ns;
}
