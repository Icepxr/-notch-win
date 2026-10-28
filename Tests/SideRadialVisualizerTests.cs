using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using VNotch.Controls;
using Xunit;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class SideRadialVisualizerTests
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData(96)] [InlineData(144)] [InlineData(192)]
    public void PlaybackFeedbackKeepsTheRingCircularAndItsArtworkCentreClear(double dpi) => SharedStaTestRunner.Run(() =>
    {
        var visualizer = new MusicVisualizer { Width = 40, Height = 40, Radial = true,
            ActiveBrush = new SolidColorBrush(Color.FromRgb(166, 155, 255)) };
        visualizer.Measure(new Size(40, 40)); visualizer.Arrange(new Rect(0, 0, 40, 40));
        typeof(MusicVisualizer).GetField("_currentOpacity", Private)!.SetValue(visualizer, 1d);
        var heights = (double[])typeof(MusicVisualizer).GetField("_drawHeights", Private)!.GetValue(visualizer)!;
        new[] { .1, .3, .95, .6, .2 }.CopyTo(heights, 0);
        var original = Render(visualizer, dpi);
        foreach (double mix in new[] { .2, .5, 1d })
        {
            typeof(MusicVisualizer).GetField("_iconMix", Private)!.SetValue(visualizer, mix);
            Assert.Equal(original.Pixels, Render(visualizer, dpi).Pixels);
        }
        int width = original.Bitmap.PixelWidth;
        int painted = 0;
        for (int y = 0; y < width; y++)
        for (int x = 0; x < width; x++)
        {
            double dx = (x + .5) * 96 / dpi - 20, dy = (y + .5) * 96 / dpi - 20;
            byte alpha = original.Pixels[(y * width + x) * 4 + 3];
            if (dx * dx + dy * dy < 11 * 11) Assert.Equal(0, alpha);
            if (alpha > 0) painted++;
        }
        Assert.True(painted > 24);
        string folder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../../.test-output"));
        Directory.CreateDirectory(folder);
        var png = new PngBitmapEncoder(); png.Frames.Add(BitmapFrame.Create(original.Bitmap));
        using var file = File.Create(Path.Combine(folder, $"side-ring-{dpi}.png")); png.Save(file);
    });

    [Fact]
    public void OppositeBarsHaveEqualLevelsWithBoundedEnergyVariation() => SharedStaTestRunner.Run(() =>
    {
        var visualizer = new MusicVisualizer();
        var heights = (double[])typeof(MusicVisualizer).GetField("_drawHeights", Private)!.GetValue(visualizer)!;
        new[] { .05, .15, 1d, .7, .2 }.CopyTo(heights, 0);
        var level = typeof(MusicVisualizer).GetMethod("RingLevel", Private)!;
        var levels = Enumerable.Range(0, 24).Select(i => (double)level.Invoke(visualizer, new object[] { i })!).ToArray();
        for (int i = 0; i < 12; i++) Assert.Equal(levels[i], levels[i + 12]);
        Assert.InRange(levels.Max() - levels.Min(), 0, .35);
        Assert.All(levels, value => Assert.InRange(value, 0, 1));
    });

    private static (RenderTargetBitmap Bitmap, byte[] Pixels) Render(MusicVisualizer control, double dpi)
    {
        var drawing = new DrawingVisual();
        using (var dc = drawing.RenderOpen()) control.RenderFrame(dc);
        var bitmap = new RenderTargetBitmap((int)(40 * dpi / 96), (int)(40 * dpi / 96), dpi, dpi, PixelFormats.Pbgra32);
        bitmap.Render(drawing);
        var pixels = new byte[bitmap.PixelWidth * bitmap.PixelHeight * 4]; bitmap.CopyPixels(pixels, bitmap.PixelWidth * 4, 0);
        return (bitmap, pixels);
    }
}
