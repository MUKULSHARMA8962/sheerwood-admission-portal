"""Editable PowerPoint summary of a submitted admission form.

The deck contains text only and uses the standard PresentationML package format.
It needs no graphics or office software on the API server.
"""

from __future__ import annotations

from io import BytesIO
from textwrap import wrap
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
SLIDE_WIDTH = 12192000
SLIDE_HEIGHT = 6858000


def _safe_text(value: str) -> str:
    return escape("".join(char for char in str(value) if ord(char) >= 32 or char in "\t\n"))


def _shape(shape_id: int, name: str, text: str, *, x: int, y: int, width: int, height: int, size: int, color: str, bold: bool = False) -> str:
    weight = ' b="1"' if bold else ""
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name="{_safe_text(name)}"/>'
        '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
        f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{width}" cy="{height}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>'
        '<p:txBody><a:bodyPr wrap="none" lIns="0" rIns="0" tIns="0" bIns="0"/>'
        '<a:lstStyle/><a:p><a:pPr algn="l"/>'
        f'<a:r><a:rPr lang="en-US" sz="{size}"{weight}><a:solidFill><a:srgbClr val="{color}"/>'
        '</a:solidFill><a:latin typeface="Arial"/></a:rPr>'
        f'<a:t>{_safe_text(text)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>'
    )


def _shape_tree() -> str:
    return (
        '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
        '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
    )


def _slide_xml(title: str, lines: list[str], number: int, total: int, application_number: str) -> bytes:
    shapes = [_shape(2, "Section title", title, x=731520, y=457200, width=10789920, height=502920, size=2800, color="173D2D", bold=True)]
    for index, line in enumerate(lines):
        shapes.append(_shape(index + 3, f"Detail {index + 1}", line, x=731520, y=1371600 + index * 304800, width=10789920, height=274320, size=1700, color="263B2E"))
    shapes.append(_shape(len(lines) + 3, "Page number", f"{application_number}    {number} / {total}", x=731520, y=6370320, width=10789920, height=274320, size=1100, color="61786A"))
    return (
        f'<p:sld xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}"><p:cSld><p:spTree>'
        + _shape_tree() + "".join(shapes)
        + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
    ).encode("utf-8")


def _slides(application_number: str, student_name: str, desired_class: str, form_lines: list[str]) -> list[tuple[str, list[str]]]:
    slides: list[tuple[str, list[str]]] = [
        ("Admission application", [
            f"Application ID: {application_number}",
            f"Student: {student_name}",
            f"Class applying for: {desired_class}",
        ])
    ]
    section = "Application details"
    entries: list[str] = []

    def add_section() -> None:
        if not entries:
            return
        wrapped = [part for line in entries for part in (wrap(line, width=64, subsequent_indent="    ", break_on_hyphens=False) or [""])]
        page_count = (len(wrapped) + 14) // 15
        lines_per_page = (len(wrapped) + page_count - 1) // page_count
        for start in range(0, len(wrapped), lines_per_page):
            title = section if start == 0 else f"{section} (continued)"
            slides.append((title, wrapped[start:start + lines_per_page]))

    for line in form_lines:
        if not line.strip():
            continue
        if ":" not in line or line.rstrip().endswith(":"):
            add_section()
            section = line.strip().rstrip(":")
            if section in {"Father", "Mother"}:
                section += " Details"
            entries = []
        else:
            entries.append(line.strip())
    add_section()
    return slides


def build_admission_pptx(*, application_number: str, student_name: str, desired_class: str, form_lines: list[str]) -> bytes:
    """Return a text-editable PPTX containing every rendered application field."""
    slides = _slides(application_number, student_name, desired_class, form_lines)
    slide_overrides = "".join(
        f'<Override PartName="/ppt/slides/slide{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        for index in range(1, len(slides) + 1)
    )
    content_types = (
        f'<Types xmlns="{CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
        '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>'
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        f'{slide_overrides}</Types>'
    )
    presentation = (
        f'<p:presentation xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}">'
        '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
        '<p:sldIdLst>'
        + "".join(f'<p:sldId id="{255 + index}" r:id="rId{index + 1}"/>' for index in range(1, len(slides) + 1))
        + f'</p:sldIdLst><p:sldSz cx="{SLIDE_WIDTH}" cy="{SLIDE_HEIGHT}" type="screen16x9"/>'
        '<p:notesSz cx="6858000" cy="9144000"/></p:presentation>'
    )
    presentation_rels = (
        f'<Relationships xmlns="{PKG}">'
        f'<Relationship Id="rId1" Type="{R}/slideMaster" Target="slideMasters/slideMaster1.xml"/>'
        + "".join(f'<Relationship Id="rId{index + 1}" Type="{R}/slide" Target="slides/slide{index}.xml"/>' for index in range(1, len(slides) + 1))
        + '</Relationships>'
    )
    slide_master = (
        f'<p:sldMaster xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}">'
        '<p:cSld name="Blank"><p:spTree>' + _shape_tree() + '</p:spTree></p:cSld>'
        '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6"'
        ' bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>'
        '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
        '<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>'
    )
    slide_layout = (
        f'<p:sldLayout xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}" type="blank" preserve="1">'
        '<p:cSld name="Blank"><p:spTree>' + _shape_tree() + '</p:spTree></p:cSld>'
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'
    )
    color_scheme = (
        '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>'
        '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
        '<a:dk2><a:srgbClr val="173D2D"/></a:dk2><a:lt2><a:srgbClr val="F4F8F5"/></a:lt2>'
        + "".join(f'<a:accent{index}><a:srgbClr val="{color}"/></a:accent{index}>' for index, color in enumerate(("08783F", "B9DDC2", "4D9168", "53695C", "718078", "DCE7DF"), 1))
        + '<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>'
    )
    theme = (
        f'<a:theme xmlns:a="{A}" name="Sheerwood"><a:themeElements>'
        f'<a:clrScheme name="Sheerwood">{color_scheme}</a:clrScheme>'
        '<a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/></a:majorFont>'
        '<a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme>'
        '<a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fillStyleLst>'
        '<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln></a:lnStyleLst>'
        '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
        '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:bgFillStyleLst>'
        '</a:fmtScheme></a:themeElements></a:theme>'
    )
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as package:
        package.writestr("[Content_Types].xml", content_types)
        package.writestr("_rels/.rels", f'<Relationships xmlns="{PKG}"><Relationship Id="rId1" Type="{R}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="{R}/extended-properties" Target="docProps/app.xml"/></Relationships>')
        package.writestr("docProps/core.xml", '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Sheerwood Admission Portal</dc:creator></cp:coreProperties>')
        package.writestr("docProps/app.xml", f'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Sheerwood Admission Portal</Application><Slides>{len(slides)}</Slides></Properties>')
        package.writestr("ppt/presentation.xml", presentation)
        package.writestr("ppt/_rels/presentation.xml.rels", presentation_rels)
        package.writestr("ppt/presProps.xml", f'<p:presentationPr xmlns:p="{P}"/>')
        package.writestr("ppt/slideMasters/slideMaster1.xml", slide_master)
        package.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", f'<Relationships xmlns="{PKG}"><Relationship Id="rId1" Type="{R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="{R}/theme" Target="../theme/theme1.xml"/></Relationships>')
        package.writestr("ppt/slideLayouts/slideLayout1.xml", slide_layout)
        package.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", f'<Relationships xmlns="{PKG}"><Relationship Id="rId1" Type="{R}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>')
        package.writestr("ppt/theme/theme1.xml", theme)
        for index, (title, lines) in enumerate(slides, 1):
            package.writestr(f"ppt/slides/slide{index}.xml", _slide_xml(title, lines, index, len(slides), application_number))
            package.writestr(f"ppt/slides/_rels/slide{index}.xml.rels", f'<Relationships xmlns="{PKG}"><Relationship Id="rId1" Type="{R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>')
    return buffer.getvalue()
