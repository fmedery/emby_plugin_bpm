using System;
using System.IO;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Drawing;

namespace Emby.Plugin.BpmTempo
{
    public class Plugin : BasePlugin, IHasThumbImage
    {
        public static Plugin Instance { get; private set; }

        public Plugin()
        {
            Instance = this;
        }

        public override string Name => "BPM & Tempo Controller";
        public override string Description => "Control music playback speed and BPM without altering pitch.";
        public override Guid Id => new Guid("7F5A4D2E-8B3C-4D1E-9A5F-6C7D8E9F0A1B");

        public Stream GetThumbImage()
        {
            var type = GetType();
            return type.Assembly.GetManifestResourceStream(type.Namespace + ".thumb.png");
        }

        public ImageFormat ThumbImageFormat => ImageFormat.Png;
    }
}
