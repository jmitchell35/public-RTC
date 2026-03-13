#!/usr/bin/env python3

from __future__ import annotations

import argparse
import datetime as dt
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.sax.saxutils import escape


SLIDE_CX = 12_192_000
SLIDE_CY = 6_858_000


@dataclass
class Slide:
    title: str
    screen_lines: list[str]
    notes: str
    visual_hint: str


def parse_markdown(markdown: str) -> list[Slide]:
    sections = re.split(r"^## Slide \d+ - ", markdown, flags=re.MULTILINE)
    headings = re.findall(r"^## Slide \d+ - (.+)$", markdown, flags=re.MULTILINE)
    slides: list[Slide] = []

    for title, raw_section in zip(headings, sections[1:]):
        screen_lines = extract_section_lines(raw_section, "**A l'ecran**", "**A dire**")
        notes_lines = extract_section_lines(raw_section, "**A dire**", "**Visuel suggere**")
        visual_lines = extract_section_lines(raw_section, "**Visuel suggere**", None)
        slides.append(
            Slide(
                title=title.strip(),
                screen_lines=screen_lines,
                notes=" ".join(notes_lines).strip(),
                visual_hint=" ".join(visual_lines).strip(),
            )
        )

    if not slides:
        raise ValueError("No slide sections found in markdown.")

    return slides


def extract_section_lines(section: str, start_marker: str, end_marker: str | None) -> list[str]:
    start = section.find(start_marker)
    if start < 0:
        return []
    start += len(start_marker)

    if end_marker is None:
        chunk = section[start:]
    else:
        end = section.find(end_marker, start)
        chunk = section[start:] if end < 0 else section[start:end]

    lines: list[str] = []
    blank_pending = False

    for raw_line in chunk.splitlines():
        line = raw_line.strip()
        if not line or line == "---":
            if lines:
                blank_pending = True
            continue

        line = line.replace("  ", " ").strip()

        if blank_pending and lines and lines[-1] != "":
            lines.append("")
        blank_pending = False

        lines.append(line)

    while lines and lines[-1] == "":
        lines.pop()

    return lines


def body_font_size(paragraphs: list[str]) -> int:
    non_empty = [item for item in paragraphs if item]
    if len(non_empty) >= 10:
        return 1600
    if len(non_empty) >= 8:
        return 1800
    if len(non_empty) >= 6:
        return 2000
    return 2200


def make_text_paragraphs(
    paragraphs: list[str],
    font_size: int,
    color: str,
    bold: bool = False,
    align: str = "l",
) -> str:
    xml_parts: list[str] = []
    for paragraph in paragraphs:
        if paragraph == "":
            xml_parts.append(
                f'<a:p><a:endParaRPr lang="fr-FR" sz="{font_size}"/></a:p>'
            )
            continue

        attrs = [f'lang="fr-FR"', f'sz="{font_size}"']
        if bold:
            attrs.append('b="1"')

        run_props = " ".join(attrs)
        fill = f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>' if color else ""
        xml_parts.append(
            "<a:p>"
            f'<a:pPr algn="{align}"/>'
            f'<a:r><a:rPr {run_props}>{fill}</a:rPr><a:t>{escape(paragraph)}</a:t></a:r>'
            f'<a:endParaRPr lang="fr-FR" sz="{font_size}"/>'
            "</a:p>"
        )
    return "".join(xml_parts)


def text_box(
    shape_id: int,
    name: str,
    x: int,
    y: int,
    cx: int,
    cy: int,
    paragraphs: list[str],
    font_size: int,
    color: str,
    bold: bool = False,
) -> str:
    return (
        "<p:sp>"
        "<p:nvSpPr>"
        f'<p:cNvPr id="{shape_id}" name="{escape(name)}"/>'
        '<p:cNvSpPr txBox="1"/>'
        "<p:nvPr/>"
        "</p:nvSpPr>"
        "<p:spPr>"
        "<a:xfrm>"
        f'<a:off x="{x}" y="{y}"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/>'
        "</a:xfrm>"
        "<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom>"
        "<a:noFill/>"
        "<a:ln><a:noFill/></a:ln>"
        "</p:spPr>"
        '<p:txBody>'
        '<a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="t"/>'
        "<a:lstStyle/>"
        f"{make_text_paragraphs(paragraphs, font_size, color, bold=bold)}"
        "</p:txBody>"
        "</p:sp>"
    )


def solid_rect(shape_id: int, name: str, x: int, y: int, cx: int, cy: int, color: str) -> str:
    return (
        "<p:sp>"
        "<p:nvSpPr>"
        f'<p:cNvPr id="{shape_id}" name="{escape(name)}"/>'
        "<p:cNvSpPr/>"
        "<p:nvPr/>"
        "</p:nvSpPr>"
        "<p:spPr>"
        "<a:xfrm>"
        f'<a:off x="{x}" y="{y}"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/>'
        "</a:xfrm>"
        "<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom>"
        f"<a:solidFill><a:srgbClr val=\"{color}\"/></a:solidFill>"
        "<a:ln><a:noFill/></a:ln>"
        "</p:spPr>"
        '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>'
        "</p:sp>"
    )


def slide_xml(slide: Slide, index: int, total: int) -> str:
    title_color = "FFFFFF"
    body_color = "0F172A"
    accent_color = "2563EB"
    body_lines = [line.replace("- ", "\u2022 ", 1) if line.startswith("- ") else line for line in slide.screen_lines]
    footer = f"{index}/{total}"

    shapes = [
        solid_rect(2, "Title Bar", 0, 0, SLIDE_CX, 700_000, "0F172A"),
        solid_rect(3, "Accent Bar", 650_000, 1_150_000, 70_000, 4_800_000, accent_color),
        text_box(4, "Title", 700_000, 120_000, 10_900_000, 420_000, [slide.title], 2_600, title_color, bold=True),
        text_box(5, "Body", 850_000, 980_000, 10_200_000, 5_100_000, body_lines, body_font_size(body_lines), body_color),
        text_box(6, "Footer", 10_700_000, 6_200_000, 900_000, 220_000, [footer], 1_000, "64748B"),
    ]

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        "<p:cSld>"
        "<p:spTree>"
        "<p:nvGrpSpPr>"
        '<p:cNvPr id="1" name=""/>'
        "<p:cNvGrpSpPr/>"
        "<p:nvPr/>"
        "</p:nvGrpSpPr>"
        "<p:grpSpPr>"
        "<a:xfrm>"
        '<a:off x="0" y="0"/>'
        '<a:ext cx="0" cy="0"/>'
        '<a:chOff x="0" y="0"/>'
        '<a:chExt cx="0" cy="0"/>'
        "</a:xfrm>"
        "</p:grpSpPr>"
        f'{"".join(shapes)}'
        "</p:spTree>"
        "</p:cSld>"
        "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>"
        "</p:sld>"
    )


def slide_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" '
        'Target="../slideLayouts/slideLayout1.xml"/>'
        "</Relationships>"
    )


def content_types_xml(slide_count: int) -> str:
    overrides = [
        '<Override PartName="/ppt/presentation.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
        '<Override PartName="/ppt/theme/theme1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
        '<Override PartName="/docProps/core.xml" '
        'ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]
    for index in range(1, slide_count + 1):
        overrides.append(
            f'<Override PartName="/ppt/slides/slide{index}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        f'{"".join(overrides)}'
        "</Types>"
    )


def root_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="ppt/presentation.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" '
        'Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" '
        'Target="docProps/app.xml"/>'
        "</Relationships>"
    )


def app_xml(slides: list[Slide]) -> str:
    titles = "".join(f"<vt:lpstr>{escape(slide.title)}</vt:lpstr>" for slide in slides)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        "<Application>Codex</Application>"
        "<PresentationFormat>On-screen Show (16:9)</PresentationFormat>"
        f"<Slides>{len(slides)}</Slides>"
        "<Notes>0</Notes>"
        "<HiddenSlides>0</HiddenSlides>"
        "<MMClips>0</MMClips>"
        "<ScaleCrop>false</ScaleCrop>"
        "<HeadingPairs>"
        '<vt:vector size="2" baseType="variant">'
        "<vt:variant><vt:lpstr>Slides</vt:lpstr></vt:variant>"
        f"<vt:variant><vt:i4>{len(slides)}</vt:i4></vt:variant>"
        "</vt:vector>"
        "</HeadingPairs>"
        "<TitlesOfParts>"
        f'<vt:vector size="{len(slides)}" baseType="lpstr">{titles}</vt:vector>'
        "</TitlesOfParts>"
        "<Company></Company>"
        "<LinksUpToDate>false</LinksUpToDate>"
        "<SharedDoc>false</SharedDoc>"
        "<HyperlinksChanged>false</HyperlinksChanged>"
        "<AppVersion>16.0000</AppVersion>"
        "</Properties>"
    )


def core_xml() -> str:
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<dc:title>RTC Chat Project</dc:title>"
        "<dc:creator>Codex</dc:creator>"
        "<cp:lastModifiedBy>Codex</cp:lastModifiedBy>"
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
        "</cp:coreProperties>"
    )


def presentation_xml(slides: list[Slide]) -> str:
    slide_ids = []
    for index in range(1, len(slides) + 1):
        slide_ids.append(f'<p:sldId id="{255 + index}" r:id="rId{index + 1}"/>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
        f'<p:sldIdLst>{"".join(slide_ids)}</p:sldIdLst>'
        f'<p:sldSz cx="{SLIDE_CX}" cy="{SLIDE_CY}" type="screen16x9"/>'
        '<p:notesSz cx="6858000" cy="9144000"/>'
        "<p:defaultTextStyle>"
        "<a:defPPr/>"
        "<a:lvl1pPr marL=\"0\" algn=\"l\"><a:defRPr sz=\"2200\"/></a:lvl1pPr>"
        "<a:lvl2pPr marL=\"457200\" algn=\"l\"><a:defRPr sz=\"1800\"/></a:lvl2pPr>"
        "</p:defaultTextStyle>"
        "</p:presentation>"
    )


def presentation_rels_xml(slides: list[Slide]) -> str:
    relationships = [
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" '
        'Target="slideMasters/slideMaster1.xml"/>'
    ]
    for index in range(1, len(slides) + 1):
        relationships.append(
            f'<Relationship Id="rId{index + 1}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" '
            f'Target="slides/slide{index}.xml"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'{"".join(relationships)}'
        "</Relationships>"
    )


def slide_master_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        '<p:cSld name="Codex Master">'
        "<p:spTree>"
        "<p:nvGrpSpPr>"
        '<p:cNvPr id="1" name=""/>'
        "<p:cNvGrpSpPr/>"
        "<p:nvPr/>"
        "</p:nvGrpSpPr>"
        "<p:grpSpPr>"
        "<a:xfrm>"
        '<a:off x="0" y="0"/>'
        '<a:ext cx="0" cy="0"/>'
        '<a:chOff x="0" y="0"/>'
        '<a:chExt cx="0" cy="0"/>'
        "</a:xfrm>"
        "</p:grpSpPr>"
        "</p:spTree>"
        "</p:cSld>"
        '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" '
        'accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" '
        'accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
        '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
        "<p:txStyles>"
        "<p:titleStyle><a:lvl1pPr algn=\"l\"><a:defRPr sz=\"2600\" b=\"1\"/></a:lvl1pPr></p:titleStyle>"
        "<p:bodyStyle><a:lvl1pPr marL=\"0\" algn=\"l\"><a:defRPr sz=\"2200\"/></a:lvl1pPr></p:bodyStyle>"
        "<p:otherStyle><a:lvl1pPr algn=\"l\"><a:defRPr sz=\"1800\"/></a:lvl1pPr></p:otherStyle>"
        "</p:txStyles>"
        "</p:sldMaster>"
    )


def slide_master_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" '
        'Target="../slideLayouts/slideLayout1.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" '
        'Target="../theme/theme1.xml"/>'
        "</Relationships>"
    )


def slide_layout_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">'
        '<p:cSld name="Blank">'
        "<p:spTree>"
        "<p:nvGrpSpPr>"
        '<p:cNvPr id="1" name=""/>'
        "<p:cNvGrpSpPr/>"
        "<p:nvPr/>"
        "</p:nvGrpSpPr>"
        "<p:grpSpPr>"
        "<a:xfrm>"
        '<a:off x="0" y="0"/>'
        '<a:ext cx="0" cy="0"/>'
        '<a:chOff x="0" y="0"/>'
        '<a:chExt cx="0" cy="0"/>'
        "</a:xfrm>"
        "</p:grpSpPr>"
        "</p:spTree>"
        "</p:cSld>"
        "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>"
        "</p:sldLayout>"
    )


def slide_layout_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" '
        'Target="../slideMasters/slideMaster1.xml"/>'
        "</Relationships>"
    )


def theme_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Codex Theme">'
        "<a:themeElements>"
        '<a:clrScheme name="Codex Colors">'
        '<a:dk1><a:srgbClr val="111827"/></a:dk1>'
        '<a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>'
        '<a:dk2><a:srgbClr val="0F172A"/></a:dk2>'
        '<a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>'
        '<a:accent1><a:srgbClr val="2563EB"/></a:accent1>'
        '<a:accent2><a:srgbClr val="0EA5E9"/></a:accent2>'
        '<a:accent3><a:srgbClr val="14B8A6"/></a:accent3>'
        '<a:accent4><a:srgbClr val="F59E0B"/></a:accent4>'
        '<a:accent5><a:srgbClr val="EF4444"/></a:accent5>'
        '<a:accent6><a:srgbClr val="7C3AED"/></a:accent6>'
        '<a:hlink><a:srgbClr val="2563EB"/></a:hlink>'
        '<a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>'
        "</a:clrScheme>"
        '<a:fontScheme name="Codex Fonts">'
        '<a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
        '<a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>'
        "</a:fontScheme>"
        '<a:fmtScheme name="Codex Format">'
        "<a:fillStyleLst>"
        '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
        '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>'
        '<a:solidFill><a:schemeClr val="accent2"/></a:solidFill>'
        "</a:fillStyleLst>"
        "<a:lnStyleLst>"
        '<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
        '<a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
        '<a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
        "</a:lnStyleLst>"
        "<a:effectStyleLst>"
        "<a:effectStyle><a:effectLst/></a:effectStyle>"
        "<a:effectStyle><a:effectLst/></a:effectStyle>"
        "<a:effectStyle><a:effectLst/></a:effectStyle>"
        "</a:effectStyleLst>"
        "<a:bgFillStyleLst>"
        '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
        '<a:solidFill><a:schemeClr val="lt1"/></a:solidFill>'
        '<a:solidFill><a:schemeClr val="lt2"/></a:solidFill>'
        "</a:bgFillStyleLst>"
        "</a:fmtScheme>"
        "</a:themeElements>"
        "<a:objectDefaults/>"
        "<a:extraClrSchemeLst/>"
        "</a:theme>"
    )


def write_pptx(slides: list[Slide], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml(len(slides)))
        archive.writestr("_rels/.rels", root_rels_xml())
        archive.writestr("docProps/app.xml", app_xml(slides))
        archive.writestr("docProps/core.xml", core_xml())
        archive.writestr("ppt/presentation.xml", presentation_xml(slides))
        archive.writestr("ppt/_rels/presentation.xml.rels", presentation_rels_xml(slides))
        archive.writestr("ppt/slideMasters/slideMaster1.xml", slide_master_xml())
        archive.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", slide_master_rels_xml())
        archive.writestr("ppt/slideLayouts/slideLayout1.xml", slide_layout_xml())
        archive.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", slide_layout_rels_xml())
        archive.writestr("ppt/theme/theme1.xml", theme_xml())
        for index, slide in enumerate(slides, start=1):
            archive.writestr(f"ppt/slides/slide{index}.xml", slide_xml(slide, index, len(slides)))
            archive.writestr(f"ppt/slides/_rels/slide{index}.xml.rels", slide_rels_xml())


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a simple PPTX deck from slide sections in markdown.")
    parser.add_argument("input", type=Path, help="Markdown file to read")
    parser.add_argument("output", type=Path, nargs="?", help="PPTX file to write")
    args = parser.parse_args()

    output = args.output or args.input.with_suffix(".pptx")
    slides = parse_markdown(args.input.read_text(encoding="utf-8"))
    write_pptx(slides, output)
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
