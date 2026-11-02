"""Generate the checked-in Xcode project and configuration with no dependencies."""
from hashlib import sha1
from pathlib import Path
import argparse
import json
import plistlib

ROOT = Path(__file__).resolve().parent
PROJECT = "StackLabCompanion"
BUNDLE = "$(COMPANION_BASE_ID)"
GROUP = "group.$(COMPANION_BASE_ID)"
objects = {}
outputs = {}


def oid(name):
    return sha1(name.encode()).hexdigest()[:24].upper()


def add(label, isa, **fields):
    key = oid(label)
    assert key not in objects
    objects[key] = dict(isa=isa, **fields)
    return key


def pbx(value, depth=0):
    indent = "\t" * depth
    if isinstance(value, dict):
        return "{\n" + "".join(f"{indent}\t{pbx(key)} = {pbx(item, depth+1)};\n" for key, item in value.items()) + indent + "}"
    if isinstance(value, list):
        return "(\n" + "".join(f"{indent}\t{pbx(item, depth+1)},\n" for item in value) + indent + ")"
    return str(value) if isinstance(value, int) else json.dumps(value, ensure_ascii=False)


def configurations(name, common):
    configs = []
    for mode in ("Debug", "Release"):
        settings = dict(common)
        if name == "Project":
            settings["SWIFT_OPTIMIZATION_LEVEL"] = "-Onone" if mode == "Debug" else "-O"
            settings["DEBUG_INFORMATION_FORMAT"] = "dwarf" if mode == "Debug" else "dwarf-with-dsym"
            settings["ENABLE_TESTABILITY"] = "YES" if mode == "Debug" else "NO"
        configs.append(add(f"config:{name}:{mode}", "XCBuildConfiguration", buildSettings=settings, name=mode))
    return add(f"config-list:{name}", "XCConfigurationList", buildConfigurations=configs,
               defaultConfigurationIsVisible=0, defaultConfigurationName="Release")


def info(name, *, extension=None, group=False):
    fields = {
        "CFBundleDevelopmentRegion": "$(DEVELOPMENT_LANGUAGE)",
        "CFBundleDisplayName": name,
        "CFBundleExecutable": "$(EXECUTABLE_NAME)",
        "CFBundleIdentifier": "$(PRODUCT_BUNDLE_IDENTIFIER)",
        "CFBundleInfoDictionaryVersion": "6.0",
        "CFBundleName": "$(PRODUCT_NAME)",
        "CFBundlePackageType": "XPC!" if extension else "APPL",
        "CFBundleShortVersionString": "$(MARKETING_VERSION)",
        "CFBundleVersion": "$(CURRENT_PROJECT_VERSION)",
    }
    if extension:
        fields["NSExtension"] = extension
    else:
        fields.update(NSSupportsLiveActivities=True, UILaunchScreen={},
                      UIApplicationSceneManifest={"UIApplicationSupportsMultipleScenes": False})
    if group:
        fields["CompanionAppGroup"] = GROUP
    return plistlib.dumps(fields)


app = PROJECT
widget = PROJECT + "Widget"
broadcast = PROJECT + "Broadcast"
shared = "PlaySummaryAttributes.swift"
store = "ProbeStore.swift"
source_lists = {
    app: [shared, store, "PlaySummaryController.swift", "App/PlayCompanionApp.swift", "App/CompanionView.swift", "App/BroadcastPicker.swift"],
    widget: [shared, "PlaySummaryWidget.swift", "Widget/PlaySummaryBundle.swift"],
    broadcast: [shared, store, "Broadcast/SampleHandler.swift"],
}
outputs["Config/App-Info.plist"] = info("스택 연구소", group=True)
outputs["Config/Widget-Info.plist"] = info("스택 연구소 요약", extension={"NSExtensionPointIdentifier": "com.apple.widgetkit-extension"})
outputs["Config/Broadcast-Info.plist"] = info("스택 연구소 연결 시험", group=True, extension={
    "NSExtensionPointIdentifier": "com.apple.broadcast-services-upload",
    "NSExtensionPrincipalClass": "$(PRODUCT_MODULE_NAME).SampleHandler",
    "RPBroadcastProcessMode": "RPBroadcastProcessModeSampleBuffer",
})
outputs["Config/AppGroup.entitlements"] = plistlib.dumps({"com.apple.security.application-groups": [GROUP]})

source_refs = {}
for path in sorted(set(sum(source_lists.values(), []))):
    assert (ROOT / path).is_file(), path
    source_refs[path] = add("file:" + path, "PBXFileReference", lastKnownFileType="sourcecode.swift", path=path, sourceTree="<group>")
for path in outputs:
    source_refs[path] = add("file:" + path, "PBXFileReference", lastKnownFileType="text.plist.xml", path=path, sourceTree="<group>")

products = {}
for name in source_lists:
    products[name] = add("product:" + name, "PBXFileReference",
        explicitFileType="wrapper.application" if name == app else "wrapper.app-extension",
        includeInIndex=0, path=name + (".app" if name == app else ".appex"), sourceTree="BUILT_PRODUCTS_DIR")
product_group = add("products", "PBXGroup", children=list(products.values()), name="Products", sourceTree="<group>")
main_group = add("main-group", "PBXGroup", children=[*source_refs.values(), product_group], sourceTree="<group>")

embed_files = [add("embed:" + name, "PBXBuildFile", fileRef=products[name], settings={"ATTRIBUTES": ["RemoveHeadersOnCopy"]})
               for name in (widget, broadcast)]
embed = add("embed", "PBXCopyFilesBuildPhase", buildActionMask=2147483647, dstPath="", dstSubfolderSpec=13,
            files=embed_files, name="Embed App Extensions", runOnlyForDeploymentPostprocessing=0)
dependencies = []
for name in (widget, broadcast):
    proxy = add("proxy:" + name, "PBXContainerItemProxy", containerPortal=oid("project"), proxyType=1,
                remoteGlobalIDString=oid("target:" + name), remoteInfo=name)
    dependencies.append(add("dependency:" + name, "PBXTargetDependency", target=oid("target:" + name), targetProxy=proxy))

targets = []
for name, suffix, plist in ((app, "", "App"), (widget, ".Widget", "Widget"), (broadcast, ".Broadcast", "Broadcast")):
    build_files = [add(f"build:{name}:{path}", "PBXBuildFile", fileRef=source_refs[path]) for path in source_lists[name]]
    source_phase = add("sources:" + name, "PBXSourcesBuildPhase", buildActionMask=2147483647,
                       files=build_files, runOnlyForDeploymentPostprocessing=0)
    config = {
        "PRODUCT_NAME": "$(TARGET_NAME)",
        "PRODUCT_BUNDLE_IDENTIFIER": BUNDLE + suffix,
        "INFOPLIST_FILE": f"Config/{plist}-Info.plist",
        "GENERATE_INFOPLIST_FILE": "NO",
        "LD_RUNPATH_SEARCH_PATHS": ["$(inherited)", "@executable_path/Frameworks"] +
            ([] if name == app else ["@executable_path/../../Frameworks"]),
    }
    if name in (app, broadcast):
        config["CODE_SIGN_ENTITLEMENTS"] = "$(COMPANION_APP_GROUP_ENTITLEMENTS)"
    if name != app:
        config.update(APPLICATION_EXTENSION_API_ONLY="YES", SKIP_INSTALL="YES")
    targets.append(add("target:" + name, "PBXNativeTarget", buildConfigurationList=configurations(name, config),
                       buildPhases=[source_phase, embed] if name == app else [source_phase], buildRules=[],
                       dependencies=dependencies if name == app else [], name=name, productName=name,
                       productReference=products[name], productType="com.apple.product-type.application" if name == app
                       else "com.apple.product-type.app-extension"))

project_config = configurations("Project", {
    "COMPANION_BASE_ID": "com.stacklab.PlayCompanion",
    "COMPANION_APP_GROUP_ENTITLEMENTS": "Config/AppGroup.entitlements",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "MARKETING_VERSION": "0.1.0",
    "IPHONEOS_DEPLOYMENT_TARGET": "16.2",
    "SDKROOT": "iphoneos",
    "SUPPORTED_PLATFORMS": "iphoneos iphonesimulator",
    "SUPPORTS_MACCATALYST": "NO",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": "1",
    "CLANG_ENABLE_MODULES": "YES",
})
project = add("project", "PBXProject", attributes={"BuildIndependentTargetsInParallel": 1, "LastSwiftUpdateCheck": 1600,
              "TargetAttributes": {target: {"CreatedOnToolsVersion": "16.0"} for target in targets}},
              buildConfigurationList=project_config, compatibilityVersion="Xcode 14.0", developmentRegion="ko",
              hasScannedForEncodings=0, knownRegions=["ko", "en", "Base"], mainGroup=main_group,
              productRefGroup=product_group, projectDirPath="", projectRoot="", targets=targets)
outputs[f"{PROJECT}.xcodeproj/project.pbxproj"] = ("// !$*UTF8*$!\n" + pbx(dict(archiveVersion=1, classes={}, objectVersion=56,
                                                      objects=objects, rootObject=project)) + "\n").encode()
ref = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{targets[0]}" BuildableName="{app}.app" BlueprintName="{app}" ReferencedContainer="container:{PROJECT}.xcodeproj"/>'
outputs[f"{PROJECT}.xcodeproj/xcshareddata/xcschemes/{PROJECT}.xcscheme"] = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.7">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
    <BuildActionEntries>
      <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref}</BuildActionEntry>
    </BuildActionEntries>
  </BuildAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="NO">
    <BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable>
  </LaunchAction>
  <AnalyzeAction buildConfiguration="Debug"/>
  <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
'''.encode()

parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
for name, content in outputs.items():
    path = ROOT / name
    if args.check:
        if not path.is_file() or path.read_bytes().replace(b"\r\n", b"\n") != content:
            raise SystemExit(f"Out of date: {name}; rerun generate-project.py")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
print(f"{len(outputs)} Xcode project/configuration files {'checked' if args.check else 'generated'}.")
