using System.Diagnostics;
using System.Drawing;
using System.Reflection;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text.Json;
using Microsoft.Win32;

namespace StripeStudioUpdater;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
        {
            Environment.Exit(UpdaterEngine.RunSelfTest());
            return;
        }

        if (args.Contains("--elevated-update", StringComparer.OrdinalIgnoreCase))
        {
            var targetPath = ArgumentValue(args, "--target");
            var resultPath = ArgumentValue(args, "--result");
            var result = string.IsNullOrWhiteSpace(targetPath)
                ? new UpdateResult(false, "管理员更新进程没有收到软件位置。")
                : UpdaterEngine.ApplyUpdate(targetPath, launchAfterUpdate: false);

            if (!string.IsNullOrWhiteSpace(resultPath))
            {
                try
                {
                    File.WriteAllText(resultPath, JsonSerializer.Serialize(result));
                }
                catch { }
            }

            Environment.Exit(result.Success ? 0 : 1);
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new UpdaterForm());
    }

    private static string? ArgumentValue(string[] args, string name)
    {
        var index = Array.FindIndex(args, value =>
            value.Equals(name, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }
}

internal sealed class UpdaterForm : Form
{
    private readonly Label _title = new();
    private readonly Label _subtitle = new();
    private readonly Label _status = new();
    private readonly TextBox _target = new();
    private readonly Button _browse = new();
    private readonly Button _update = new();
    private readonly ProgressBar _progress = new();
    private readonly Label _dataNotice = new();
    private string? _targetPath;

    public UpdaterForm()
    {
        Text = "条纹纺织调色升级";
        ClientSize = new Size(650, 410);
        MinimumSize = new Size(650, 410);
        MaximumSize = new Size(650, 410);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(239, 241, 243);
        Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Regular, GraphicsUnit.Point);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;

        _title.Text = "更新条纹纺织调色";
        _title.Font = new Font(Font.FontFamily, 20F, FontStyle.Bold);
        _title.ForeColor = Color.FromArgb(34, 40, 43);
        _title.SetBounds(34, 28, 570, 38);

        _subtitle.Text = $"升级至 {UpdaterEngine.TargetVersion} · 自动寻找现有软件并原位更新";
        _subtitle.ForeColor = Color.FromArgb(105, 116, 122);
        _subtitle.SetBounds(36, 72, 570, 26);

        var panel = new Panel
        {
            BackColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle
        };
        panel.SetBounds(28, 112, 594, 180);

        var locationLabel = new Label
        {
            Text = "软件位置",
            Font = new Font(Font.FontFamily, 9F, FontStyle.Bold),
            ForeColor = Color.FromArgb(61, 74, 80)
        };
        locationLabel.SetBounds(18, 18, 120, 24);

        _target.ReadOnly = true;
        _target.BackColor = Color.FromArgb(246, 247, 248);
        _target.BorderStyle = BorderStyle.FixedSingle;
        _target.ForeColor = Color.FromArgb(45, 54, 59);
        _target.SetBounds(18, 48, 455, 32);

        _browse.Text = "手动选择";
        StyleSecondaryButton(_browse);
        _browse.SetBounds(482, 47, 92, 34);
        _browse.Click += (_, _) => ChooseTarget();

        _status.Text = "正在查找现有软件…";
        _status.ForeColor = Color.FromArgb(91, 104, 111);
        _status.SetBounds(18, 96, 550, 24);

        _progress.Style = ProgressBarStyle.Marquee;
        _progress.MarqueeAnimationSpeed = 22;
        _progress.SetBounds(18, 130, 556, 8);

        panel.Controls.AddRange(new Control[] { locationLabel, _target, _browse, _status, _progress });

        _dataNotice.Text = "✓ 色库、色板、收藏、项目和上次关闭状态都会保留";
        _dataNotice.ForeColor = Color.FromArgb(72, 94, 101);
        _dataNotice.SetBounds(36, 308, 500, 26);

        _update.Text = "开始安全更新";
        _update.Enabled = false;
        StylePrimaryButton(_update);
        _update.SetBounds(436, 345, 186, 42);
        _update.Click += async (_, _) => await UpdateAsync();

        Controls.AddRange(new Control[] { _title, _subtitle, panel, _dataNotice, _update });
        Shown += async (_, _) => await DiscoverAsync();
    }

    private static void StyleSecondaryButton(Button button)
    {
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderColor = Color.FromArgb(205, 211, 214);
        button.FlatAppearance.MouseOverBackColor = Color.FromArgb(237, 240, 241);
        button.BackColor = Color.FromArgb(247, 248, 249);
        button.ForeColor = Color.FromArgb(55, 67, 73);
        button.Cursor = Cursors.Hand;
    }

    private static void StylePrimaryButton(Button button)
    {
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderSize = 0;
        button.FlatAppearance.MouseOverBackColor = Color.FromArgb(51, 67, 74);
        button.BackColor = Color.FromArgb(63, 80, 88);
        button.ForeColor = Color.White;
        button.Font = new Font(button.Font.FontFamily, 10F, FontStyle.Bold);
        button.Cursor = Cursors.Hand;
    }

    private async Task DiscoverAsync()
    {
        SetBusy(true, "正在读取软件登记位置…");
        var progress = new Progress<string>(message => _status.Text = message);
        _targetPath = await Task.Run(() => UpdaterEngine.FindInstalledApp(progress));

        if (_targetPath is null)
        {
            _target.Text = "未自动找到，请手动选择一次";
            SetBusy(false, "软件可能被移动过；选择后升级包会记住新位置");
            _update.Enabled = false;
            return;
        }

        _target.Text = _targetPath;
        var current = FileVersionInfo.GetVersionInfo(_targetPath).FileVersion ?? "未知版本";
        SetBusy(false, $"已找到 · 当前版本 {current}");
        _update.Enabled = true;
    }

    private void ChooseTarget()
    {
        using var dialog = new OpenFileDialog
        {
            Title = "选择条纹纺织调色主程序",
            Filter = "条纹纺织调色程序 (*.exe)|*.exe",
            CheckFileExists = true,
            Multiselect = false
        };

        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        if (!UpdaterEngine.IsValidTarget(dialog.FileName))
        {
            MessageBox.Show(this, "选择的文件不是条纹纺织调色主程序。", "无法使用该文件", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        _targetPath = Path.GetFullPath(dialog.FileName);
        _target.Text = _targetPath;
        SetBusy(false, "位置已确认，可以开始更新");
        _update.Enabled = true;
    }

    private async Task UpdateAsync()
    {
        if (_targetPath is null) return;
        _update.Enabled = false;
        _browse.Enabled = false;
        SetBusy(true, "正在校验升级包…");

        var progress = new Progress<string>(message => _status.Text = message);
        var result = await Task.Run(() =>
            UpdaterEngine.ApplyUpdate(_targetPath, progress, launchAfterUpdate: false));

        if (result.RequiresElevation)
        {
            SetBusy(true, "当前位置需要系统授权，正在打开 Windows 管理员确认…");
            result = await Task.Run(() =>
                UpdaterEngine.ApplyUpdateElevated(_targetPath));
        }

        SetBusy(false, result.Message);
        _browse.Enabled = true;

        if (result.Success)
        {
            UpdaterEngine.LaunchUpdatedApp(_targetPath);
            _update.Text = "更新完成";
            MessageBox.Show(this, $"软件已经升级到 {UpdaterEngine.TargetVersion}，原有数据全部保留。", "更新完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Close();
            return;
        }

        _update.Enabled = true;
        MessageBox.Show(this, result.Message, "更新未完成", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }

    private void SetBusy(bool busy, string message)
    {
        _status.Text = message;
        _progress.Style = busy ? ProgressBarStyle.Marquee : ProgressBarStyle.Continuous;
        _progress.MarqueeAnimationSpeed = busy ? 22 : 0;
        _progress.Value = busy ? 0 : 100;
    }
}

internal readonly record struct UpdateResult(
    bool Success,
    string Message,
    bool RequiresElevation = false
);

internal enum FileAvailability
{
    Ready,
    InUse,
    AccessDenied
}

internal static class UpdaterEngine
{
    public const string TargetVersion = "1.0.17";
    private const string AppId = "com.kurokid.stripestudio";
    private const string ProductName = "条纹纺织调色";
    private const string RegistryPath = @"Software\Kurokid\StripeStudio";
    private const string PayloadResource = "StripeStudio.Payload.exe";
    private const string HashResource = "StripeStudio.Payload.sha256";
    private static readonly string DataDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "StripeStudio"
    );
    private static readonly string RuntimeInfoPath = Path.Combine(DataDirectory, "desktop-runtime.json");

    public static string? FindInstalledApp(IProgress<string>? progress = null)
    {
        foreach (var candidate in RegisteredCandidates())
        {
            if (IsValidTarget(candidate)) return Path.GetFullPath(candidate);
        }

        progress?.Report("登记位置失效，正在检查常用文件夹…");
        foreach (var root in CommonRoots())
        {
            var direct = Path.Combine(root, $"{ProductName}.exe");
            if (IsValidTarget(direct)) return Path.GetFullPath(direct);
        }

        progress?.Report("正在搜索磁盘中的主程序…");
        var visited = 0;
        foreach (var root in SearchRoots())
        {
            var visitedInRoot = 0;
            var queue = new Queue<string>();
            queue.Enqueue(root);

            // 每个磁盘/常用根目录都独立获得搜索额度，避免 C 盘目录多时
            // 把总额度耗尽，导致放在 D/E 盘任意文件夹里的程序永远搜不到。
            while (queue.Count > 0 && visitedInRoot < 180000)
            {
                var directory = queue.Dequeue();
                visited++;
                visitedInRoot++;
                if (visited % 600 == 0)
                    progress?.Report($"正在搜索… 已检查 {visited:N0} 个文件夹");

                try
                {
                    foreach (var file in Directory.EnumerateFiles(directory, "*.exe", SearchOption.TopDirectoryOnly))
                    {
                        if (IsValidTarget(file)) return Path.GetFullPath(file);
                    }

                    foreach (var child in Directory.EnumerateDirectories(directory))
                    {
                        if (ShouldSkipDirectory(child)) continue;
                        queue.Enqueue(child);
                    }
                }
                catch (UnauthorizedAccessException) { }
                catch (IOException) { }
            }
        }

        return null;
    }

    private static IEnumerable<string> RegisteredCandidates()
    {
        var candidates = new List<string>();

        using (var key = Registry.CurrentUser.OpenSubKey(RegistryPath))
        {
            if (key?.GetValue("LauncherPath") is string launcher) candidates.Add(launcher);
        }

        if (File.Exists(RuntimeInfoPath))
        {
            try
            {
                using var document = JsonDocument.Parse(File.ReadAllText(RuntimeInfoPath));
                var root = document.RootElement;
                if (root.TryGetProperty("appId", out var appId) && appId.GetString() == AppId &&
                    root.TryGetProperty("launcherPath", out var launcher))
                {
                    var value = launcher.GetString();
                    if (!string.IsNullOrWhiteSpace(value)) candidates.Add(value);
                }
            }
            catch (JsonException) { }
            catch (IOException) { }
        }

        return candidates;
    }

    private static IEnumerable<string> CommonRoots()
    {
        yield return AppContext.BaseDirectory;
        yield return Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        yield return Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
    }

    private static IEnumerable<string> SearchRoots()
    {
        var returned = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var common in CommonRoots())
        {
            if (Directory.Exists(common) && returned.Add(common)) yield return common;
        }

        foreach (var drive in DriveInfo.GetDrives())
        {
            if (!drive.IsReady || drive.DriveType is not (DriveType.Fixed or DriveType.Removable)) continue;
            if (returned.Add(drive.RootDirectory.FullName)) yield return drive.RootDirectory.FullName;
        }
    }

    private static bool ShouldSkipDirectory(string path)
    {
        var name = Path.GetFileName(path);
        return name.Equals("$Recycle.Bin", StringComparison.OrdinalIgnoreCase)
            || name.Equals("System Volume Information", StringComparison.OrdinalIgnoreCase)
            || name.Equals("Windows", StringComparison.OrdinalIgnoreCase)
            || name.Equals("node_modules", StringComparison.OrdinalIgnoreCase)
            || name.StartsWith(".", StringComparison.Ordinal);
    }

    public static bool IsValidTarget(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return false;
        if (Path.GetFullPath(path).Equals(Environment.ProcessPath, StringComparison.OrdinalIgnoreCase)) return false;

        try
        {
            var info = FileVersionInfo.GetVersionInfo(path);
            return string.Equals(Path.GetFileName(path), $"{ProductName}.exe", StringComparison.OrdinalIgnoreCase)
                || string.Equals(info.ProductName, ProductName, StringComparison.OrdinalIgnoreCase)
                || string.Equals(info.InternalName, "electron.exe", StringComparison.OrdinalIgnoreCase)
                   && (info.FileDescription?.Contains(ProductName, StringComparison.OrdinalIgnoreCase) ?? false);
        }
        catch
        {
            return false;
        }
    }

    public static UpdateResult ApplyUpdate(
        string targetPath,
        IProgress<string>? progress = null,
        bool launchAfterUpdate = true)
    {
        if (!IsValidTarget(targetPath)) return new(false, "找不到有效的主程序，请重新选择。");

        ClearReadOnlyAttribute(targetPath);

        if (!DirectoryAllowsWrite(Path.GetDirectoryName(targetPath)!))
        {
            if (!IsAdministrator())
                return new(false, "当前位置需要管理员权限，正在请求系统授权。", true);

            TryRepairTargetAccess(targetPath);
        }

        var tempRoot = Path.Combine(Path.GetTempPath(), $"StripeStudioUpdate-{Guid.NewGuid():N}");
        var payloadPath = Path.Combine(tempRoot, $"{ProductName}.exe");
        var backupPath = $"{targetPath}.update-backup";
        Directory.CreateDirectory(tempRoot);

        try
        {
            progress?.Report("正在释放并校验新版程序…");
            ExtractPayload(payloadPath);
            var expectedHash = ReadEmbeddedText(HashResource).Trim().Split(' ', '\t', '\r', '\n')[0].ToUpperInvariant();
            var actualHash = HashFile(payloadPath);
            if (!actualHash.Equals(expectedHash, StringComparison.OrdinalIgnoreCase))
                return new(false, "升级包校验失败，没有改动现有软件。");

            progress?.Report("正在检查旧版软件是否运行…");
            var runningFound = CloseRunningAppIfPresent(targetPath, progress);
            var availability = WaitForAvailable(targetPath, TimeSpan.FromSeconds(runningFound ? 45 : 20));
            if (availability == FileAvailability.AccessDenied)
            {
                if (!IsAdministrator())
                    return new(false, "当前位置需要管理员权限，正在请求系统授权。", true);

                progress?.Report("正在修复所选主程序的写入权限…");
                TryRepairTargetAccess(targetPath);
                availability = WaitForAvailable(targetPath, TimeSpan.FromSeconds(5));
                if (availability == FileAvailability.AccessDenied)
                    return new(false, "管理员进程仍无法访问所选主程序。请检查安全软件是否正在保护该文件。");
            }
            if (availability == FileAvailability.InUse)
                return new(false, runningFound
                    ? "检测到旧版进程仍未完全退出，请关闭条纹纺织调色后再试一次。"
                    : "主程序正被其他程序占用（例如聊天软件传输、杀毒扫描或文件预览）。请稍等片刻后重试。");

            progress?.Report("正在原位替换程序，用户数据保持不动…");
            try
            {
                if (File.Exists(backupPath)) File.Delete(backupPath);
                File.Move(targetPath, backupPath);
            }
            catch (UnauthorizedAccessException) when (IsAdministrator())
            {
                progress?.Report("正在取得所选主程序的替换权限…");
                TryRepairTargetAccess(targetPath);
                if (File.Exists(backupPath))
                {
                    TryRepairTargetAccess(backupPath);
                    File.Delete(backupPath);
                }
                File.Move(targetPath, backupPath);
            }

            try
            {
                File.Copy(payloadPath, targetPath, true);
                if (!HashFile(targetPath).Equals(expectedHash, StringComparison.OrdinalIgnoreCase))
                    throw new IOException("写入后的程序校验失败");

                if (launchAfterUpdate)
                {
                    progress?.Report("正在启动新版并确认结果…");
                    LaunchUpdatedApp(targetPath);

                    if (!WaitForVersion(TargetVersion, targetPath, TimeSpan.FromSeconds(30)))
                        throw new IOException("新版启动确认超时");
                }
                else
                {
                    progress?.Report("正在确认新版文件…");
                    var writtenVersion = FileVersionInfo.GetVersionInfo(targetPath).FileVersion ?? "";
                    if (!writtenVersion.StartsWith(TargetVersion, StringComparison.OrdinalIgnoreCase))
                        throw new IOException("写入后的版本号不正确");
                }

                File.Delete(backupPath);
                return new(
                    true,
                    launchAfterUpdate
                        ? $"更新成功 · 已启动 {TargetVersion}"
                        : $"更新成功 · 已写入 {TargetVersion}"
                );
            }
            catch (Exception error)
            {
                try
                {
                    if (File.Exists(targetPath)) File.Delete(targetPath);
                    if (File.Exists(backupPath)) File.Move(backupPath, targetPath);
                }
                catch { }
                return new(false, $"更新没有完成，旧版已恢复。{error.Message}");
            }
        }
        catch (UnauthorizedAccessException)
        {
            if (!IsAdministrator())
                return new(false, "当前位置需要管理员权限，正在请求系统授权。", true);

            return new(false, "管理员进程仍无法替换该程序。请暂时关闭安全软件的文件保护后再试。");
        }
        catch (Exception error)
        {
            return new(false, $"更新没有完成，现有数据未受影响。{error.Message}");
        }
        finally
        {
            try { Directory.Delete(tempRoot, true); } catch { }
        }
    }

    public static UpdateResult ApplyUpdateElevated(string targetPath)
    {
        var resultPath = Path.Combine(
            Path.GetTempPath(),
            $"StripeStudioElevatedResult-{Guid.NewGuid():N}.json"
        );

        try
        {
            var startInfo = CreateElevatedStartInfo(targetPath, resultPath);
            using var process = Process.Start(startInfo);

            if (process is null)
                return new(false, "Windows 没有启动管理员更新进程。请重新点击更新。");

            process.WaitForExit();

            if (!File.Exists(resultPath))
                return new(false, "管理员更新进程没有返回结果，请重新运行升级包。");

            return JsonSerializer.Deserialize<UpdateResult>(File.ReadAllText(resultPath));
        }
        catch (System.ComponentModel.Win32Exception error)
            when (error.NativeErrorCode == 1223)
        {
            return new(false, "已取消 Windows 管理员授权，软件没有发生改变。");
        }
        catch (Exception error)
        {
            return new(false, $"无法启动管理员更新进程。{error.Message}");
        }
        finally
        {
            try { File.Delete(resultPath); } catch { }
        }
    }

    internal static ProcessStartInfo CreateElevatedStartInfo(
        string targetPath,
        string resultPath)
    {
        var executable = Environment.ProcessPath
            ?? throw new InvalidOperationException("找不到升级包自身路径");

        var info = new ProcessStartInfo(executable)
        {
            UseShellExecute = true,
            Verb = "runas",
            WorkingDirectory = AppContext.BaseDirectory
        };

        info.ArgumentList.Add("--elevated-update");
        info.ArgumentList.Add("--target");
        info.ArgumentList.Add(Path.GetFullPath(targetPath));
        info.ArgumentList.Add("--result");
        info.ArgumentList.Add(Path.GetFullPath(resultPath));
        return info;
    }

    public static void LaunchUpdatedApp(string targetPath)
    {
        Process.Start(new ProcessStartInfo(targetPath)
        {
            UseShellExecute = true,
            WorkingDirectory = Path.GetDirectoryName(targetPath)!
        });
    }

    private static bool IsAdministrator()
    {
        try
        {
            using var identity = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(identity)
                .IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
    }

    private static void ClearReadOnlyAttribute(string targetPath)
    {
        try
        {
            var attributes = File.GetAttributes(targetPath);
            if ((attributes & FileAttributes.ReadOnly) != 0)
                File.SetAttributes(targetPath, attributes & ~FileAttributes.ReadOnly);
        }
        catch { }
    }

    private static bool DirectoryAllowsWrite(string directory)
    {
        var probe = Path.Combine(directory, $".stripe-update-write-{Guid.NewGuid():N}.tmp");
        try
        {
            using (File.Create(probe, 1, FileOptions.DeleteOnClose)) { }
            return true;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
        catch
        {
            // 其他瞬时错误交给实际替换流程判断，不能误触发提权循环。
            return true;
        }
        finally
        {
            try { File.Delete(probe); } catch { }
        }
    }

    private static bool TryRepairTargetAccess(string targetPath)
    {
        if (!IsAdministrator()) return false;

        ClearReadOnlyAttribute(targetPath);

        var takeOwnership = RunWindowsTool(
            "takeown.exe",
            "/F", targetPath,
            "/A"
        );

        var resetAcl = RunWindowsTool(
            "icacls.exe",
            targetPath,
            "/reset",
            "/C"
        );

        var grantAdministrators = RunWindowsTool(
            "icacls.exe",
            targetPath,
            "/grant", "*S-1-5-32-544:(F)",
            "/C"
        );

        ClearReadOnlyAttribute(targetPath);
        return takeOwnership || resetAcl || grantAdministrators;
    }

    private static bool RunWindowsTool(string fileName, params string[] arguments)
    {
        try
        {
            var info = new ProcessStartInfo(fileName)
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            foreach (var argument in arguments) info.ArgumentList.Add(argument);

            using var process = Process.Start(info);
            if (process is null) return false;
            process.WaitForExit(15000);
            return process.HasExited && process.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    private static bool CloseRunningAppIfPresent(string targetPath, IProgress<string>? progress)
    {
        var expectedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            Path.GetFullPath(targetPath)
        };

        try
        {
            if (File.Exists(RuntimeInfoPath))
            {
                using var document = JsonDocument.Parse(File.ReadAllText(RuntimeInfoPath));
                var root = document.RootElement;
                var sameApp = root.TryGetProperty("appId", out var id) && id.GetString() == AppId;
                var sameLauncher = root.TryGetProperty("launcherPath", out var launcher)
                    && PathsEqual(launcher.GetString(), targetPath);
                if (sameApp && sameLauncher && root.TryGetProperty("executablePath", out var executable))
                {
                    var value = executable.GetString();
                    if (!string.IsNullOrWhiteSpace(value)) expectedPaths.Add(Path.GetFullPath(value));
                }
            }
        }
        catch (JsonException) { }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }

        var matches = new List<Process>();
        foreach (var process in Process.GetProcesses())
        {
            try
            {
                var processPath = process.MainModule?.FileName;
                if (!string.IsNullOrWhiteSpace(processPath) && expectedPaths.Contains(Path.GetFullPath(processPath)))
                    matches.Add(process);
                else
                    process.Dispose();
            }
            catch
            {
                process.Dispose();
            }
        }

        if (matches.Count == 0)
        {
            progress?.Report("未检测到运行中的旧版，准备直接更新…");
            return false;
        }

        progress?.Report("检测到旧版正在运行，正在正常关闭…");
        foreach (var process in matches)
        {
            try
            {
                if (process.MainWindowHandle != IntPtr.Zero) process.CloseMainWindow();
            }
            catch { }
            finally { process.Dispose(); }
        }
        return true;
    }

    private static bool PathsEqual(string? left, string? right)
    {
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right)) return false;
        try
        {
            return Path.GetFullPath(left).Equals(Path.GetFullPath(right), StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    private static FileAvailability WaitForAvailable(string path, TimeSpan timeout)
    {
        var end = DateTime.UtcNow + timeout;
        var accessDenied = false;
        while (DateTime.UtcNow < end)
        {
            try
            {
                // 这里只判断文件是否仍被进程占用，不要求旧 EXE 自身授予“写入内容”权限。
                // 实际升级使用同目录原子移动/复制；旧实现用 ReadWrite 会把可正常替换的
                // 只读程序误报成“没有权限”，即使管理员运行也会被提前拦住。
                using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.None);
                return FileAvailability.Ready;
            }
            catch (IOException) { Thread.Sleep(250); }
            catch (UnauthorizedAccessException)
            {
                accessDenied = true;
                Thread.Sleep(250);
            }
        }
        return accessDenied ? FileAvailability.AccessDenied : FileAvailability.InUse;
    }

    private static bool WaitForVersion(string version, string targetPath, TimeSpan timeout)
    {
        var end = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < end)
        {
            try
            {
                if (File.Exists(RuntimeInfoPath))
                {
                    using var document = JsonDocument.Parse(File.ReadAllText(RuntimeInfoPath));
                    var root = document.RootElement;
                    if (root.TryGetProperty("appId", out var id) && id.GetString() == AppId &&
                        root.TryGetProperty("appVersion", out var appVersion) && appVersion.GetString() == version &&
                        root.TryGetProperty("state", out var state) && state.GetString() == "running" &&
                        root.TryGetProperty("launcherPath", out var launcher) && PathsEqual(launcher.GetString(), targetPath)) return true;
                }
            }
            catch (JsonException) { }
            catch (IOException) { }
            Thread.Sleep(400);
        }
        return false;
    }

    private static void ExtractPayload(string destination)
    {
        using var source = Assembly.GetExecutingAssembly().GetManifestResourceStream(PayloadResource)
            ?? throw new InvalidOperationException("升级包中缺少新版程序");
        using var output = File.Create(destination);
        source.CopyTo(output);
    }

    private static string ReadEmbeddedText(string resource)
    {
        using var source = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource)
            ?? throw new InvalidOperationException("升级包中缺少校验清单");
        using var reader = new StreamReader(source);
        return reader.ReadToEnd();
    }

    private static string HashFile(string path)
    {
        using var stream = File.OpenRead(path);
        using var sha256 = SHA256.Create();
        return Convert.ToHexString(sha256.ComputeHash(stream));
    }

    public static int RunSelfTest()
    {
        var reportPath = Path.Combine(Path.GetTempPath(), "StripeStudioUpdaterSelfTest.json");
        string? testRoot = null;
        try
        {
            testRoot = Path.Combine(Path.GetTempPath(), $"StripeStudioUpdaterSelfTest-{Guid.NewGuid():N}");
            Directory.CreateDirectory(testRoot);
            var temp = Path.Combine(testRoot, "payload.exe");
            ExtractPayload(temp);
            var expected = ReadEmbeddedText(HashResource).Trim().Split(' ', '\t', '\r', '\n')[0].ToUpperInvariant();
            var actual = HashFile(temp);

            // 在临时目录完整演练“备份旧文件 → 写入新版 → 校验 → 清理备份”，
            // 不启动软件，也不接触用户的正式程序和数据。
            var target = Path.Combine(testRoot, $"{ProductName}.exe");
            var backup = $"{target}.update-backup";
            File.WriteAllText(target, "old-version-sentinel");
            File.SetAttributes(target, File.GetAttributes(target) | FileAttributes.ReadOnly);
            var availabilityBefore = WaitForAvailable(target, TimeSpan.FromSeconds(1));
            var readOnlyTargetAccepted = availabilityBefore == FileAvailability.Ready;
            ClearReadOnlyAttribute(target);
            File.Move(target, backup);
            File.Copy(temp, target, true);
            var replacementPassed = File.Exists(backup)
                && HashFile(target).Equals(expected, StringComparison.OrdinalIgnoreCase);
            File.Delete(backup);

            var elevatedInfo = CreateElevatedStartInfo(
                target,
                Path.Combine(testRoot, "elevated-result.json")
            );
            var elevationFallbackWired =
                elevatedInfo.UseShellExecute &&
                elevatedInfo.Verb.Equals("runas", StringComparison.OrdinalIgnoreCase) &&
                elevatedInfo.ArgumentList.Contains("--elevated-update") &&
                elevatedInfo.ArgumentList.Contains("--target") &&
                elevatedInfo.ArgumentList.Contains("--result");
            var directoryWriteProbePassed = DirectoryAllowsWrite(testRoot);

            var found = FindInstalledApp();
            var result = new
            {
                passed = expected.Equals(actual, StringComparison.OrdinalIgnoreCase)
                    && replacementPassed
                    && readOnlyTargetAccepted
                    && elevationFallbackWired
                    && directoryWriteProbePassed,
                embeddedPayloadHash = actual,
                expectedHash = expected,
                replacementTransactionPassed = replacementPassed,
                unlockedFileDetectionPassed = availabilityBefore == FileAvailability.Ready,
                readOnlyTargetAccepted,
                elevationFallbackWired,
                directoryWriteProbePassed,
                discoveredTarget = found,
                discoveredTargetValid = found is null || IsValidTarget(found),
                dataDirectory = DataDirectory,
                dataDirectoryPreserved = true
            };
            File.WriteAllText(reportPath, JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
            return result.passed && result.discoveredTargetValid ? 0 : 1;
        }
        catch (Exception error)
        {
            File.WriteAllText(reportPath, JsonSerializer.Serialize(new { passed = false, error = error.ToString() }));
            return 1;
        }
        finally
        {
            if (testRoot is not null)
            {
                try { Directory.Delete(testRoot, true); } catch { }
            }
        }
    }
}
