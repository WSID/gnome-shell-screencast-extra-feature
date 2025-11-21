#!/bin/bash

# This script builds necessary files using various tools.

gnome-extensions pack \
    --extra-source=parts/ \
    --extra-source=data/icons/ \
    --podir=po/ \
    --force
