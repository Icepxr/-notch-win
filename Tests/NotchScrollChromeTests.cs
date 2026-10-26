using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Threading;
using Xunit;

namespace VNotch.Tests;

public sealed class NotchScrollChromeTests
{
    [Fact]
    public void ThinDarkScrollbarStillPagesAndScrollsToTheEnd() => SharedStaTestRunner.RunAsync(async () =>
    {
        var scroll = new ScrollViewer
        {
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            Content = new TextBlock { Text = string.Join("\n", Enumerable.Range(1, 100)), Foreground = Brushes.White }
        };
        scroll.Resources.MergedDictionaries.Add(new ResourceDictionary
        { Source = new Uri("/V-Notch;component/Controls/NotchScrollChrome.xaml", UriKind.Relative) });
        var window = new BackgroundWindow { Width = 244, Height = 180, Content = scroll, Background = Brushes.Black };
        try
        {
            window.Show(); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            scroll.ApplyTemplate(); scroll.UpdateLayout();
            var bar = (ScrollBar)scroll.Template.FindName("PART_VerticalScrollBar", scroll);
            Assert.Equal(10, bar.Width);
            bar.ApplyTemplate();
            var track = (Track)bar.Template.FindName("PART_Track", bar);
            Assert.NotNull(track.Thumb);
            Assert.Equal(26, track.Thumb.MinHeight);
            Assert.Equal(Colors.Transparent, ((SolidColorBrush)bar.Background).Color);
            ScrollBar.PageDownCommand.Execute(null, bar);
            await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Assert.True(scroll.VerticalOffset > 0);
            scroll.ScrollToEnd(); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Assert.InRange(scroll.ScrollableHeight - scroll.VerticalOffset, 0, .1);
        }
        finally { window.Close(); }
    });
}
