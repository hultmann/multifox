#!/usr/bin/python
# -*- coding: utf-8 -*-

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import string
import shutil
import codecs


def get_hash(path):
    import hashlib
    f = open(path, "rb")
    h = hashlib.sha512()
    while True:
        data = f.read(8192)
        if data:
            h.update(data)
        else:
            break
    f.close()
    return "sha512:" + h.hexdigest()


def copy_bin(src, dst):
    ensure_path_exists(dst)
    shutil.copyfile(src, dst)


def ensure_path_exists(path):
    dir = os.path.dirname(path)
    if os.path.exists(dir) == False:
        os.makedirs(dir)


def getVersionedString(changeset, ver):
    import datetime
    if changeset == None:
        return ver + "." + datetime.datetime.now().strftime("%j.%H-%M")
    else:
        return changeset


class BuildExtension:

    def __init__(self, dir_src, dir_dst):
        self.__src = dir_src + "/"
        self.__dst = dir_dst + "/unpacked/"
        self.__xpi_path = dir_dst + "/xpi/"
        self.__vars = {}
        self.__text = []
        self.__binary = []
        self.__locales = []


    def set_var(self, name, val):
        self.__vars[name] = val


    def get_var(self, name):
        return self.__vars[name]


    def add_binary(self, path):
        self.__binary.append(path)


    def add_text(self, path):
        self.__text.append(path)


    def add_locale(self, code):
        self.__locales.append(code)


    def create_update_rdf(self, xpi_name):
        src_update = self.__src + "update.rdf"
        if os.path.exists(src_update):
          self.__update(src_update, self.__xpi_path + xpi_name)


    def build_xpi(self, xpi_name):
        self.__updateInstallRdf()
        self.set_var("XPI_NAME", xpi_name)
        self.__createXpi()


    def __updateInstallRdf(self):
        txt = self.__load_text_file(self.__src + "install.rdf")
        f = codecs.open(self.__dst + "install.rdf", "w", "utf-8")
        f.write(txt)
        f.close()


    def __createXpi(self):
        ensure_path_exists(self.__xpi_path)

        import zipfile
        zip = zipfile.ZipFile(self.__xpi_path + self.get_var("XPI_NAME"), "w", zipfile.ZIP_DEFLATED)
        for root, dirs, files in os.walk(self.__dst):
            for name in files:
                fs_path = os.path.join(root, name)
                zip_path = fs_path.replace(self.__dst, "", 1)
                zip.write(fs_path, zip_path)
        zip.close()


    def __update(self, src_update, xpi):
        self.set_var("XPI_HASH", get_hash(xpi))
        self.__parse_text_file(src_update, xpi + "-update.rdf")


    def copy_files(self):
        if os.path.exists(self.__dst):
            shutil.rmtree(self.__dst)

        self.__copy_binary_files()
        self.__copy_text_files()


    def __copy_binary_files(self):
        for myFile in self.__binary:
            src = self.__src + myFile
            dst = self.__dst + myFile
            copy_bin(src, dst)


    def __copy_text_files(self):
        for myFile in self.__text:
            if (myFile.count("${locale}") == 0):
                self.__parse_text_file(self.__src + myFile, self.__dst + myFile)
            else:
                for loc in self.__locales:
                    myFile2 = string.Template(myFile).substitute(locale=loc)
                    self.__parse_text_file(self.__src + myFile2, self.__dst + myFile2)


    def __parse_text_file(self, input_path, output_path):
        buf = self.__load_text_file(input_path)
        all_lines = buf.splitlines(True)

        for idx, line in enumerate(all_lines):
            if (line.startswith("#include ")):
                file = line.split("\"")[1]
                #txt = self.__load_text_file("src/content/" + file)
                #print os.path.dirname(input_path) + "----" + file + "///" + input_path
                src = os.path.join(os.path.dirname(input_path), file)
                txt = self.__load_text_file(src)
                all_lines[idx] = txt

        buf = "".join(all_lines)

        ensure_path_exists(output_path)
        f = codecs.open(output_path, "w", "utf-8")
        f.write(buf)
        f.close()


    def __load_text_file(self, path):
        f = codecs.open(path, "r", "utf-8")
        all_lines = f.readlines()
        f.close()

        # convert to unix eol (and remove trailing spaces)
        for idx, line in enumerate(all_lines):
            all_lines[idx] = all_lines[idx].rstrip()

        txt = "\n".join(all_lines) + "\n"
        buf = string.Template(txt).safe_substitute(self.__vars) # safe==>%1$S
        return buf
