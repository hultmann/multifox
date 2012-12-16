/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var m_welcomeMode = false;

function setWelcomeMode(enable) {
  if (m_welcomeMode === enable) {
    return;
  }

  m_welcomeMode = enable; // TODO check logged in tabs (attribute)

  // update current tab (all windows)
  var enumWin = UIUtils.getWindowEnumerator();
  while (enumWin.hasMoreElements()) {
    var win = enumWin.getNext();
    var icon = getIconContainer(win.document);
    if (enable) {
      icon.setAttribute("current-error", "welcome");
    } else {
      icon.removeAttribute("current-error");
      insertIcon(false, null, win.document);
    }
    updateUIAsync(UIUtils.getSelectedTab(win), true);
  }
}


function updateUIAsync(tab, updateTopLogin) {
  if (tab.hasAttribute("selected") === false) {
    return;
  }
  var doc = tab.ownerDocument;
  if (updateTopLogin === false) {
    // 3rd-party icon?
    var container = getIconContainer(doc);
    if (container !== null) {
      if (container.hasAttribute("hidden") === false) {
        return;
      }
    }
  }
  // workaround to make it non-blocking
  doc.defaultView.mozRequestAnimationFrame(function() {
    updateUIAsyncCore(tab);
  });
}


function updateUIAsyncCore(tab) {
  if (tab.hasAttribute("selected") === false) {
    return;
  }

try {
  var topInnerId = getCurrentTopInnerId(tab);
  if (UserState.hasUsers(topInnerId) === false) {
    if (m_welcomeMode === false) {
      hideUI(tab.ownerDocument, false);
      return;
    }
  }

  // show button
  var doc = tab.ownerDocument;
  var container = getIconContainer(doc);
  if (container === null) {
    container = createContainer(doc);
    initIcon(doc, container, topInnerId);
  } else if (container.hasAttribute("hidden")) {
    container.removeAttribute("hidden");
  }
  updateIconCore(doc, container, topInnerId, tab);

} catch (ex) {
console.error(ex);
}
}


function hideUI(xulDoc, remove) {
  var container = getIconContainer(xulDoc);
  if (container === null) {
    return;
  }
  if (remove) {
    container.parentNode.removeChild(container);
  } else {
    container.setAttribute("hidden", "true");
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
//   <menupopup/>
// </hbox>


function createContainer(doc) {
  var container = getIconContainer(doc);
  if (container === null) {
    var ref = doc.getElementById("urlbar-icons");
    container = ref.insertBefore(doc.createElement("hbox"), ref.firstChild);
    container.setAttribute("id", "multifox-icon");
    container.setAttribute("align", "center");
  }
  return container;
}


function createBoxDom(container) {
  var doc = container.ownerDocument;
  var container2 = container.appendChild(doc.createElement("box"));
  var contextMenu = container.appendChild(doc.createElement("menupopup"));
  var container3 = container2.appendChild(doc.createElement("hbox"));
  var stat = container3.appendChild(doc.createElement("hbox"));
  var label = container3.appendChild(doc.createElement("label"));

  container2.setAttribute("tooltiptext", "${EXT_NAME}");
  container3.setAttribute("align", "center");
  stat.setAttribute("hidden", "true");
  stat.setAttribute("id", "multifox-icon-stat-icon");

  // context menu
  container.setAttribute("context", "_child");
  contextMenu.addEventListener("popupshowing", onContextPopupShown, false);

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


function updateIconCore(doc, container, topInnerId, tab) {
  if (m_welcomeMode) {
    getIconLabel(doc).setAttribute("value", "${EXT_NAME}");
    insertIcon(true, "${PATH_CONTENT}/favicon.ico", doc);
    return;
  }

  var tabDocData = WinMap.getInnerEntry(topInnerId);
  var username;
  if ("docUserObj" in tabDocData) {
    // tab has an user
    var u = tabDocData.docUserObj.user;
    username = u.isNewAccount ? util.getText("icon.add-account.label")
                              : u.plainName;
  } else {
    // 3rd-party users only
    username = "\u271a";
  }
  getIconLabel(doc).setAttribute("value", username);
  updateIcon(tab, container);
}


function updateIcon(tab, container) {
  var currentError = container.hasAttribute("current-error") ? container.getAttribute("current-error") : "";
  var newError = tab.hasAttribute("multifox-tab-error") ? tab.getAttribute("multifox-tab-error") : "";
  if (currentError !== newError) {
    container.setAttribute("current-error", newError);
    insertIcon(newError.length > 0, "chrome://global/skin/icons/warning-16.png", tab.ownerDocument); // ubuntu: 22x22
  }
}


function insertIcon(show, url, doc) {
  var statIcon = getStatIconContainer(doc);
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


function initIcon(doc, container, topInnerId) {
  console.assert(container.children.length === 0, "container has children");
  createBoxDom(container);
  setStyleCore(container.style, doc);

  var tab = UIUtils.getSelectedTab(doc.defaultView);
  if (tab.hasAttribute("multifox-logging-in")) {
    tab.removeAttribute("multifox-logging-in");
    container.style.opacity = "0";
    container.style.MozTransition = "opacity .3s ease";
    doc.defaultView.setTimeout(function() {
      container.style.opacity = "1";
    }, 50);
  }

  initIconNormal(doc);
}



function initIconNormal(doc) {
  var statIcon = getStatIconContainer(doc);
  var container = getIconContainer(doc);
  var lab = getIconLabel(doc).style;

  doc.defaultView.setTimeout(function() {
    // workaround
    // otherwise, mousedown on icon will close and open popup, even with stopPropagation
    statIcon.addEventListener("mousedown", showMsgPanel, false);
    // firstChild => avoid conflict with contextMenu
    container.firstChild.addEventListener("mousedown", showMenuPopup, false);
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
  return m_welcomeMode ? false : evt.target.localName === "image";
}


function showMsgPanel(evt) {
  if (isMsgPopup(evt) === false) {
    return;
  }

  var doc = evt.target.ownerDocument;
  initIconPressed(doc, "msg");

  var ns = util.loadSubScript("${PATH_MODULE}/popup.js");
  var panel = ns.createMsgPanel(doc);

  panel.addEventListener("popuphidden", function(evt) {
    initIconNormal(doc);
    var tab = UIUtils.getSelectedTab(doc.defaultView);
    tab.removeAttribute("multifox-tab-error");
    updateUIAsync(tab, true); // remove error msg
  }, false);

  panel.openPopup(getStatIconContainer(doc), "bottomcenter topleft", 5, 0); // due to img.style.margin
}


function onContextPopupShown(evt) {
  var menupopup = evt.originalTarget;
  var ns = util.loadSubScript("${PATH_MODULE}/popup.js");
  ns.createContextMenu(menupopup);
}


function showMenuPopup(evt) {
  if ((evt.button !== 0) || (evt.detail !== 1)) {
    // allow only left clicks
    return;
  }

  var doc = evt.target.ownerDocument;
  var container = getIconContainer(doc);

  if (m_welcomeMode) {
    var ns = util.loadSubScript("${PATH_MODULE}/welcome.js");
    var panel = ns.welcomePopup(doc);
    panel.openPopup(container, "bottomcenter topright");
    return;
  }

  if (isMsgPopup(evt)) {
    return;
  }

  initIconPressed(doc, "menu");
  var menupopup = doc.getElementById("mainPopupSet").appendChild(doc.createElement("menupopup"));
  var ns = util.loadSubScript("${PATH_MODULE}/popup.js");
  ns.createLoginsMenu(menupopup);
  menupopup.openPopup(container, "after_end", 0, 1);
}
