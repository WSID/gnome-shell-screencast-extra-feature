#!/bin/bash

# This script builds necessary files using various tools.

gnome-extensions pack \
    --extra-source=parts/ \
    --extra-source=data/icons/ \
    --schema=schemas/screencast.extra.feature@wissle.me.gschema.xml \
    --podir=po/ \
    --force
