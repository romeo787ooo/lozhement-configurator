"""Sample the first inner shell surface along the insertion direction (mm)."""
import numpy as np


def cavity_grid(vertices, faces, direction, step=2, bounds=None, margin_cells=1):
    # Both halves are stored with their opening at Y=0.
    origin = [-220, -154]
    nx, ny = 221, 155
    if bounds is not None:
        low, high = np.asarray(bounds)
        origin = (np.floor(low / step) * step).tolist()
        nx, ny = (np.ceil((high - origin) / step).astype(int) + 1).tolist()
    depth = np.full((ny, nx), np.inf)
    for tri in vertices[faces]:
        xy = tri[:, [0, 2]]
        z = tri[:, 1] * direction
        if z.max() < 0:
            continue
        low = np.maximum(0, np.ceil((xy.min(0) - origin) / step).astype(int))
        high = np.minimum([nx - 1, ny - 1], np.floor((xy.max(0) - origin) / step).astype(int))
        if np.any(high < low):
            continue
        u, v = xy[1] - xy[0], xy[2] - xy[0]
        det = u[0] * v[1] - u[1] * v[0]
        if abs(det) < 1e-9:
            continue
        ix, iy = np.meshgrid(np.arange(low[0], high[0] + 1), np.arange(low[1], high[1] + 1))
        qx, qy = origin[0] + ix * step - xy[0, 0], origin[1] + iy * step - xy[0, 1]
        a, b = (qx * v[1] - qy * v[0]) / det, (u[0] * qy - u[1] * qx) / det
        hit = z[0] + a * (z[1] - z[0]) + b * (z[2] - z[0])
        valid = (a >= -1e-8) & (b >= -1e-8) & (a + b <= 1 + 1e-8) & (hit >= 0)
        depth[iy, ix] = np.minimum(depth[iy, ix], np.where(valid, hit, np.inf))
    # Empty rays are outside the cavity. Conservative neighbourhood protects
    # interpolation at rounded edges and the mesh's 0.3 mm tessellation error.
    depth[~np.isfinite(depth)] = 0
    padded = np.pad(depth, margin_cells, mode="constant")
    safe = np.minimum.reduce([padded[j:j + ny, i:i + nx]
                             for j in range(2*margin_cells+1) for i in range(2*margin_cells+1)])
    return dict(origin=origin, step=step, nx=nx, ny=ny,
                depth=np.round(np.maximum(0, safe - 0.5), 2).ravel().tolist())
