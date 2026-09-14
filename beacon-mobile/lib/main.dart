import 'dart:async';
import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'core/widgets.dart';
import 'data/api_client.dart';
import 'data/mqtt_balasan.dart';
import 'data/repository.dart';
import 'screens/dashboard.dart';
import 'screens/control.dart';
import 'screens/prisms.dart';
import 'screens/results.dart';

/// Alamat backend.
///
/// Bawaannya SERVER, bukan localhost. Aplikasi yang dipasang di ponsel operator
/// tidak punya dev server di sebelahnya; bawaan localhost berarti setiap build
/// rilis yang lupa memberi flag akan gagal menghubungi apa pun, dan gagalnya
/// baru ketahuan di lapangan.
///
/// Untuk menunjuk dev server saat mengembangkan:
///
///   flutter run --dart-define=BEACON_API=http://localhost:3000
const alamatApi = String.fromEnvironment(
  'BEACON_API',
  defaultValue: 'https://demo-adr.monitoring4system.com',
);

/// Broker balasan alat. Nilai bawaannya sama dengan `NEXT_PUBLIC_MQTT_*` yang
/// dipakai halaman web, supaya ponsel mendengar topik yang sama.
const mqttHost = String.fromEnvironment(
  'BEACON_MQTT_HOST',
  defaultValue: 'mqtt.beacontelemetry.com',
);
const mqttPort = int.fromEnvironment('BEACON_MQTT_WS_PORT', defaultValue: 8083);
const mqttUser = String.fromEnvironment(
  'BEACON_MQTT_USER',
  defaultValue: 'userlog',
);
const mqttPass = String.fromEnvironment(
  'BEACON_MQTT_PASS',
  defaultValue: 'b34c0n',
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final repo = BeaconRepository(
    api: ApiClient(baseUrl: alamatApi),
    mqtt: MqttBalasan(
      host: mqttHost,
      port: mqttPort,
      username: mqttUser,
      password: mqttPass,
    ),
  );
  await repo.load();
  runApp(BeaconApp(repo: repo));
}

class BeaconApp extends StatelessWidget {
  const BeaconApp({super.key, required this.repo});
  final BeaconRepository repo;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Beacon Mobile',
    debugShowCheckedModeBanner: false,
    theme: beaconTheme(),
    home: ListenableBuilder(
      listenable: repo,
      builder: (_, _) =>
          repo.loggedIn ? HomeShell(repo: repo) : LoginPage(repo: repo),
    ),
  );
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.repo});
  final BeaconRepository repo;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final user = TextEditingController(), password = TextEditingController();
  final form = GlobalKey<FormState>();
  bool visible = false;
  bool masuk = false;
  String? error;
  @override
  void dispose() {
    user.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: ListView(
            padding: const EdgeInsets.all(28),
            shrinkWrap: true,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Image.asset(
                  'assets/logo.png',
                  width: 145,
                  height: 48,
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 35),
              Container(
                constraints: const BoxConstraints(minHeight: 150),
                padding: const EdgeInsets.symmetric(vertical: 20),
                decoration: BoxDecoration(
                  color: ink,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Row(
                  children: [
                    const SizedBox(width: 24),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'BEACON / MOBILE',
                            style: TextStyle(
                              fontSize: 10,
                              letterSpacing: 1.5,
                              color: Colors.white70,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Presisi di\nsetiap titik.',
                            style: display(27, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.only(right: 16),
                      child: InstrumentImage(size: 94),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              Text('Selamat datang.', style: display(30)),
              const SizedBox(height: 8),
              const Text(
                'Pantau pergeseran dan kelola pengukuran dalam satu aplikasi.',
                style: TextStyle(color: muted),
              ),
              const SizedBox(height: 24),
              Form(
                key: form,
                child: Column(
                  children: [
                    TextFormField(
                      controller: user,
                      autofillHints: const [AutofillHints.username],
                      decoration: const InputDecoration(
                        labelText: 'Username',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (v) =>
                          v == null || v.trim().isEmpty ? 'Isi username' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: password,
                      obscureText: !visible,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          tooltip: visible
                              ? 'Sembunyikan password'
                              : 'Tampilkan password',
                          onPressed: () => setState(() => visible = !visible),
                          icon: Icon(
                            visible
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                        ),
                      ),
                      validator: (v) =>
                          v == null || v.isEmpty ? 'Isi password' : null,
                      onFieldSubmitted: (_) => login(),
                    ),
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Text(
                          error!,
                          style: const TextStyle(color: danger),
                        ),
                      ),
                    const SizedBox(height: 22),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: masuk ? null : login,
                        child: Text(masuk ? 'Menghubungkan…' : 'Masuk'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              const Center(
                child: Text(
                  'BEACON ENGINEERING',
                  style: TextStyle(fontSize: 9, color: muted, letterSpacing: 2),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
  Future<void> login() async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (!form.currentState!.validate() || masuk) return;
    setState(() {
      masuk = true;
      error = null;
    });
    try {
      await widget.repo.login(user.text, password.text);
    } catch (e) {
      if (mounted) {
        setState(() => error = e.toString().replaceFirst('Bad state: ', ''));
      }
    } finally {
      if (mounted) setState(() => masuk = false);
    }
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.repo});
  final BeaconRepository repo;
  @override
  State<HomeShell> createState() => _HomeShellState();
}

const judulHalaman = [
  'Ringkasan',
  'Kontrol ADR',
  'Prism Config',
  'Hasil pengukuran',
];

class _HomeShellState extends State<HomeShell> {
  int index = 0;
  final scroll = ScrollController();
  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  void navigate(int i) {
    setState(() => index = i);
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final repo = widget.repo;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        elevation: 0,
        shape: const Border(bottom: BorderSide(color: line, width: 0.7)),
        title: Text(
          judulHalaman[index],
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.6,
            color: ink,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Akun dan informasi',
            style: IconButton.styleFrom(
              backgroundColor: paper,
              foregroundColor: ink,
              fixedSize: const Size(42, 42),
            ),
            onPressed: () => sheet(
              context,
              'Operator',
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Beacon Mobile · v1.0.0',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      unawaited(repo.logout());
                    },
                    icon: const Icon(Icons.logout),
                    label: const Text('Keluar'),
                  ),
                ],
              ),
            ),
            icon: const Icon(Icons.person_outline_rounded, size: 21),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
                  child: Material(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => sheet(
                        context,
                        'Pilih site',
                        Column(
                          children: repo.sites
                              .asMap()
                              .entries
                              .map(
                                (e) => ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  leading: CircleAvatar(
                                    backgroundColor: paper,
                                    child: Icon(
                                      Icons.location_on_outlined,
                                      color: e.key == repo.selected
                                          ? navy
                                          : muted,
                                    ),
                                  ),
                                  title: Text(
                                    e.value.name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  subtitle: Text(e.value.location),
                                  trailing: e.key == repo.selected
                                      ? const Icon(
                                          Icons.check_circle,
                                          color: navy,
                                        )
                                      : null,
                                  onTap: () {
                                    repo.selectSite(e.key);
                                    Navigator.pop(context);
                                    if (scroll.hasClients) scroll.jumpTo(0);
                                  },
                                ),
                              )
                              .toList(),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.location_on_outlined,
                              color: navy,
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              repo.site.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                repo.site.logger,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: muted,
                                ),
                              ),
                            ),
                            const Icon(Icons.keyboard_arrow_down, size: 20),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                if (repo.storageError != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: TextButton(
                      onPressed: repo.refresh,
                      child: Text(
                        repo.storageError!,
                        style: const TextStyle(color: danger),
                      ),
                    ),
                  ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: repo.refresh,
                    child: repo.loading
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(height: 100),
                              Center(child: CircularProgressIndicator()),
                              SizedBox(height: 20),
                              Center(child: Text('Memuat data…')),
                            ],
                          )
                        : repo.error != null
                        ? ListView(
                            padding: const EdgeInsets.all(20),
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              EmptyState(
                                'Data belum tersedia',
                                repo.error!,
                                action: 'Coba lagi',
                                onAction: repo.refresh,
                                icon: Icons.cloud_off_outlined,
                              ),
                            ],
                          )
                        : ListView(
                            controller: scroll,
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            children: [
                              KeyedSubtree(
                                key: ValueKey('${repo.site.id}-$index'),
                                child: switch (index) {
                                  0 => DashboardPage(
                                    repo: repo,
                                    onNavigate: navigate,
                                  ),
                                  1 => ControlPage(repo: repo),
                                  2 => PrismsPage(repo: repo),
                                  _ => ResultsPage(repo: repo),
                                },
                              ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: navigate,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.space_dashboard_outlined),
            selectedIcon: Icon(Icons.space_dashboard),
            label: 'Ringkasan',
          ),
          NavigationDestination(
            icon: Icon(Icons.tune_outlined),
            selectedIcon: Icon(Icons.tune),
            label: 'Kontrol',
          ),
          NavigationDestination(
            icon: Icon(Icons.my_location_outlined),
            selectedIcon: Icon(Icons.my_location),
            label: 'Prisma',
          ),
          NavigationDestination(
            icon: Icon(Icons.analytics_outlined),
            selectedIcon: Icon(Icons.analytics),
            label: 'Hasil',
          ),
        ],
      ),
    );
  }
}
