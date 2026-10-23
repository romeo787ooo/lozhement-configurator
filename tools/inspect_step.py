"""Inspect named STEP assembly parts and their local bounds."""
import json
import sys
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.TDF import TDF_LabelSequence, TDF_Label
from OCP.TDataStd import TDataStd_Name
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.TopLoc import TopLoc_Location


def read_parts(path):
    reader = STEPCAFControl_Reader()
    reader.SetNameMode(True)
    reader.ReadFile(path)
    doc = TDocStd_Document(TCollection_ExtendedString("doc"))
    if not reader.Transfer(doc):
        raise ValueError("STEP transfer failed")
    tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    roots = TDF_LabelSequence()
    tool.GetFreeShapes(roots)
    parts = []

    def walk(label, location, names):
        ref = TDF_Label()
        if tool.IsReference_s(label):
            tool.GetReferredShape_s(label, ref)
            location = location.Multiplied(tool.GetLocation_s(label))
        else:
            ref = label
        attr = TDataStd_Name()
        name = ""
        if ref.FindAttribute(TDataStd_Name.GetID_s(), attr):
            name = attr.Get().ToExtString()
        children = TDF_LabelSequence()
        if tool.GetComponents_s(ref, children):
            for i in range(1, children.Length() + 1):
                walk(children.Value(i), location, names + [name])
        else:
            shape = tool.GetShape_s(ref).Moved(location)
            box = Bnd_Box()
            BRepBndLib.Add_s(shape, box)
            parts.append((names + [name], shape, box.Get()))

    for i in range(1, roots.Length() + 1):
        walk(roots.Value(i), TopLoc_Location(), [])
    return parts


if __name__ == "__main__":
    for i, (names, shape, bounds) in enumerate(read_parts(sys.argv[1])):
        print(i, json.dumps(names), [round(v, 3) for v in bounds])
