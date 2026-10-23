// Local customization: agent page uses the existing coordinator/shell, including reduced motion.
using System.Windows.Input;
using VNotch.Models;
using VNotch.Services;

namespace VNotch;
public partial class MainWindow
{
    private bool _isAgentView;
    private double AgentViewWidth
    {
        get { var screen = MonitorSelection.Resolve(_settings); return Math.Clamp(screen.WorkingArea.Width / MonitorSelection.GetScale(screen) - 64, 400, 660); }
    }
    private double AgentViewHeight
    {
        get { var screen = MonitorSelection.Resolve(_settings); return Math.Clamp(screen.WorkingArea.Height / MonitorSelection.GetScale(screen) - 80, 280, 560); }
    }
    private void AgentIconButton_Click(object sender, MouseButtonEventArgs e)
    { e.Handled = true; if (!_isAnimating) NavigateToNotchView(NotchView.Agents); }
}
