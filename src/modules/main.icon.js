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


function updateUI(tab) {
  if (tab.hasAttribute("selected") === false) {
    return;
  }

  var doc = tab.ownerDocument;
  var iconContainer = getIconNode(doc);
  if (Profile.getIdentity(tab) === Profile.UnknownIdentity) {
    // remove badge
    if (iconContainer !== null) {
      iconContainer.parentNode.removeChild(iconContainer);
    }
    return;
  }

  if (iconContainer === null) {
    var ref = doc.getElementById("urlbar-icons");
    iconContainer = ref.appendChild(doc.createElement("hbox"));
    iconContainer.setAttribute("hidden", "true");
    iconContainer.setAttribute("id", "multifox-icon");
    var win = doc.defaultView;
    var delay = getTabs(win.getBrowser()).length > 1 ? 50 : 250;
    win.setTimeout(initBadge, delay, doc); // open window => greater delay
    return;
  }

  if (iconContainer.firstChild !== null) { // waiting initBadge?
    updateBadgeProfile(tab, iconContainer);
    updateBadgeLogin(tab, iconContainer);
    updateBadgeError(tab, iconContainer);
  }
}


function getIconNode(doc) {
  return doc.getElementById("multifox-icon");
}


function updateBadgeProfile(tab, iconContainer) {
  var labelId = iconContainer.querySelector("label");
  labelId.setAttribute("value", Profile.getIdentity(tab));
}


function updateBadgeLogin(tab, iconContainer) {
  var label = iconContainer.querySelectorAll("label")[1];

  if (tab.hasAttribute("multifox-tab-has-login")) {
    var val = tab.getAttribute("multifox-tab-has-login");
    label.setAttribute("value", val);
    label.removeAttribute("hidden");
  } else {
    if (label.hasAttribute("hidden") === false) {
      label.setAttribute("hidden", "true");
      label.setAttribute("value", "");
    }
  }
}


function updateBadgeError(tab, iconContainer) {
  var currentError = iconContainer.getAttribute("current-error");
  var newError = tab.getAttribute("multifox-tab-error");
  if (currentError === newError) {
    return;
  }

  iconContainer.setAttribute("current-error", newError);
  var doc = tab.ownerDocument;
  var stat = doc.getElementById("multifox-icon-stat-icon");
  while (stat.firstChild) {
    stat.removeChild(stat.firstChild);
  }

  if (newError.length === 0) {
    stat.setAttribute("hidden", "true");
    return;
  }

  var img = stat.appendChild(doc.createElement("image"));
  img.setAttribute("src", "chrome://global/skin/icons/warning-16.png"); // ubuntu: 22x22
  img.setAttribute("width", "16");
  img.setAttribute("height", "16");
  img.style.margin = "0 -4px 0 7px";
  stat.removeAttribute("hidden");
}


// <hbox align="center" id="multifox-icon">
//   <box>
//     <hbox align="center">
//       <hbox id="multifox-icon-stat-icon">
//         <image src="warning.png"/>
//       </hbox>
//       <label value="100"/>
//       <label value="LOGIN"/>

function initBadge(doc) {
  var iconContainer = getIconNode(doc);
  if (iconContainer === null) {
    // e.g. user changed tab!
    console.log("initBadge ignored! " + iconContainer);
    return;
  }


  iconContainer.setAttribute("align", "center");
  iconContainer.style.margin = "0px 2px 0px 1px";

  var icon = iconContainer.appendChild(doc.createElement("box"));
  icon.setAttribute("tooltiptext", "${EXT_NAME}");


  var styleIcon = icon.style;
  styleIcon.padding = "0px";
  styleIcon.margin = "0px";
  styleIcon.background = "transparent repeat-x";
  styleIcon.MozBorderRadius = "2px"; // Gecko 1.9.2
  styleIcon.borderRadius = "2px";
  styleIcon.minHeight = "16px";


  var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
  switch (os) {
    case "Darwin":
      styleIcon.backgroundImage = "url(${PATH_CONTENT}/icon-osx.png)";
      styleIcon.backgroundColor = "#416ea5";
      break;
    case "WINNT":
      styleIcon.backgroundImage = "url(${PATH_CONTENT}/icon.png)";
      styleIcon.backgroundColor = "#4ab0f6";
      break;
    default:
      styleIcon.backgroundImage = "url(${PATH_CONTENT}/icon-linux.png)";
      styleIcon.backgroundColor = "#6184c3";
      break;
  }



  var labelContainer = icon.appendChild(doc.createElement("hbox"));
  labelContainer.setAttribute("align", "center");


  var stat = labelContainer.appendChild(doc.createElement("hbox"));
  stat.setAttribute("hidden", "true");
  stat.setAttribute("id", "multifox-icon-stat-icon");

  var tab = doc.defaultView.getBrowser().selectedTab;
  var labelId = labelContainer.appendChild(doc.createElement("label"));
  labelId.setAttribute("value", Profile.getIdentity(tab));
  var styleLabel = labelId.style;

  styleLabel.color = "white";
  styleLabel.fontWeight = "bold";
  styleLabel.fontStyle = "normal";
  styleLabel.textRendering = "optimizelegibility";
  styleLabel.textShadow = "1px 1px 1px black";
  styleLabel.padding = "0px 9px";
  styleLabel.margin = "-1px 0px";


  var loginStyle = labelContainer.appendChild(doc.createElement("label")).style;
  loginStyle.color = "white";
  loginStyle.fontWeight = "bold";
  loginStyle.fontStyle = "normal";
  loginStyle.textRendering = "optimizelegibility";
  loginStyle.textShadow = "1px 1px 1px black, 0 1px 5px white, 3px 0 5px white, 0 -1px 5px white, -3px 0 5px white";


  initIconNormal(icon);

  updateBadgeProfile(tab, iconContainer);
  updateBadgeLogin(tab, iconContainer);
  updateBadgeError(tab, iconContainer);

  iconContainer.removeAttribute("hidden");
}


function initIconNormal(icon) {
  icon.ownerDocument.defaultView.setTimeout(function() {
    // workaround
    // otherwise, mousedown on icon will close and open popup, even with stopPropagation
    icon.addEventListener("mousedown", openMultifoxPopup, false);
  }, 0);
  icon.addEventListener("mouseover", onIconHover, false);
  icon.addEventListener("mouseout", onIconHover, false);
  icon.style.backgroundPosition = "0pt 0pt";
  icon.querySelector("label").style.textShadow = "1px 1px 1px black";
}


function initIconPressed(icon) { // openpopup
  icon.removeEventListener("mousedown", openMultifoxPopup, false);
  icon.removeEventListener("mouseover", onIconHover, false);
  icon.removeEventListener("mouseout", onIconHover, false);
  icon.style.backgroundPosition = "0pt -64px";
  icon.querySelector("label").style.textShadow = "1px 1px 1px black, 0 1px 5px white, 3px 0 5px white, 0 -1px 5px white, -3px 0 5px white";
}


function onIconHover(evt) {
  var doc = evt.target.ownerDocument;
  var icon = getIconNode(doc).firstChild;

  switch (evt.type) {
    case "mouseover":
      icon.style.backgroundPosition = "0pt -32px";
      icon.querySelector("label").style.textShadow = "1px 1px 1px black, 0 1px 5px white, 3px 0 5px white, 0 -1px 5px white, -3px 0 5px white";
      break;
    case "mouseout":
      icon.style.backgroundPosition = "0pt 0pt";
      icon.querySelector("label").style.textShadow = "1px 1px 1px black";
      break;
  }
}


function openMultifoxPopup(evt) {
  var icon = evt.currentTarget; //or this
  var tab = icon.ownerDocument.defaultView.getBrowser().selectedTab;
  var afterId = Profile.getIdentity(tab);

  Components.utils.import("${PATH_MODULE}/popup.js");
  var panel = createMultifoxPopup(icon, Profile);
  initIconPressed(icon);

  panel.addEventListener("popuphidden", function(evt) {
    initIconNormal(icon);

    var beforeId = Profile.getIdentity(tab);
    if (beforeId !== afterId) {
      tab.linkedBrowser.reload();
    }
  }, false);

  panel.openPopup(icon, "after_end", 0, 1);

  // remove error icon
  tab.removeAttribute("multifox-tab-error");
  updateUI(tab);
}
