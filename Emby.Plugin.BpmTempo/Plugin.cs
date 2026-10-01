using System;
using System.Collections.Generic;
using System.IO;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Drawing;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Emby.Plugin.BpmTempo.Configuration;

namespace Emby.Plugin.BpmTempo
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages, IHasThumbImage
    {
        public static Plugin Instance { get; private set; }

        public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
        }

        public override string Name => "BPM & Tempo Controller";
        public override string Description => "Control music BPM and tempo without altering pitch, with key transposition and BPM calculation for Emby music libraries.";
        public override Guid Id => new Guid("7F5A4D2E-8B3C-4D1E-9A5F-6C7D8E9F0A1B");

        public IEnumerable<PluginPageInfo> GetPages()
        {
            return new[]
            {
                new PluginPageInfo
                {
                    Name = "bpmsettings",
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.bpmsettings.html",
                    EnableInMainMenu = false
                },
                new PluginPageInfo
                {
                    Name = "bpmsettingsjs",
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.bpmsettings.js"
                }
            };
        }

        public Stream GetThumbImage()
        {
            var type = GetType();
            return type.Assembly.GetManifestResourceStream(type.Namespace + ".thumb.png");
        }

        public ImageFormat ThumbImageFormat => ImageFormat.Png;
    }
}
