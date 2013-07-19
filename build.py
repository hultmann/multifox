#!/usr/bin/python
# -*- coding: utf-8 -*-

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import build_tools
import sys

if len(sys.argv) > 1:
    changeset = sys.argv[1]
else:
    changeset = None

b = build_tools.BuildExtension()

b.add_binary("icon.png")
b.add_binary("content/favicon.ico")
b.add_binary("content/logo-about.png")
b.add_binary("content/logo-popup.png")
b.add_binary("content/icon.png")
b.add_binary("content/icon-linux.png")
b.add_binary("content/icon-osx.png")


b.add_text("install.rdf")
b.add_text("chrome.manifest")
b.add_text("bootstrap.js")

b.add_text("content/content-injection.js")
b.add_text("content/about-multifox.html")
b.add_text("content/about-multifox.js")

b.add_text("modules/new-window.js")
b.add_text("modules/main.js")
b.add_text("modules/menus.js")
b.add_text("modules/error.js")
b.add_text("modules/popup.js")
b.add_text("modules/actions.js")


b.add_locale("en-US")
"""
b.add_locale("pt-BR")
b.add_locale("es-ES")
b.add_locale("fr")
b.add_locale("sv-SE")
b.add_locale("zh-CN")
b.add_locale("zh-TW")
b.add_locale("sr")
"""


b.add_text("locale/${locale}/general.properties")
b.add_text("locale/${locale}/about.properties")

b.set_var("EXT_VERSION", "2.0.0")
verEx = build_tools.getVersionedString(changeset, b.get_var("EXT_VERSION"))

if changeset == None:
    b.set_var("SOURCE_URL", "https://github.com/hultmann/multifox/tree/master/src")
    b.set_var("EXT_VERSION", verEx)
else:
    b.set_var("SOURCE_URL", "https://github.com/hultmann/multifox/tree/" + changeset)


b.set_var("EXT_ID",          "multifox@hultmann")
b.set_var("EXT_NAME",        "Multifox")
b.set_var("EXT_SITE",        "http://br.mozdev.org/multifox/")
b.set_var("APP_MIN_VERSION", "22.0")
b.set_var("APP_MAX_VERSION", "24.*")
b.set_var("CHROME_NAME",     "multifox")
b.set_var("RESOURCE_NAME",   "multifox-" + verEx)

b.set_var("PATH_CONTENT",    "chrome://multifox/content")
b.set_var("PATH_LOCALE",     "chrome://multifox/locale")
b.set_var("PATH_MODULE",     "resource://" + b.get_var("RESOURCE_NAME"))

b.set_var("BASE_DOM_ID",            "multifox-dom")

b.set_var("XPCOM_ABOUT_CLASS",      "{347c41b6-1417-411c-b87a-422bcfc1899a}")
b.set_var("XPCOM_ABOUT_CONTRACT",   "@mozilla.org/network/protocol/about;1?what=multifox")

xpi = b.get_var("CHROME_NAME") + "-" + b.get_var("EXT_VERSION") + ".xpi"
b.build("src", "build", xpi)
