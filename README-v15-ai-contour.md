# v15 — AI contour generation experiment

- The AI action now performs the full pipeline: background/object segmentation, mask cleanup, largest-component filtering, and automatic contour creation.
- Contour extraction follows boundary pixels in order using Moore-neighbour tracing rather than sorting boundary points by angle around a centroid. This avoids crossed chords and better preserves concave regions.
- The binary mask is lightly cleaned before tracing to reduce small isolated artifacts and one-pixel gaps.
- The contour remains editable in the existing sketch editor and keeps the item's aspect ratio when mapped into the item dimensions.

Limitations: this is still an experimental classical contour extraction step applied to the AI segmentation mask. It cannot guarantee perfect contours for thin parts, touching objects, transparent items, or a poor AI mask. Verify the result and edit points before applying it to a production insert.

## CarveKit local segmentation

The contour editor can use the optional local CarveKit service. Install dependencies with `pip install -r requirements-carvekit.txt`, start `uvicorn carvekit_server:app --host 127.0.0.1 --port 7000`, then open the configurator through a local web server. The browser sends the selected image to localhost and receives an alpha mask; the image is not sent to a remote application server.
