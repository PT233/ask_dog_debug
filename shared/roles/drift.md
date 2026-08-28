# Source and deployment-drift evidence contract

Trace the running artifact back through process, launch/service entry, deployed file or image, configuration, and source identity.

Observe PID executable/cmdline/cwd, service or container definition, mounted files, checksums, timestamps, release/dev selector, image digest, environment, launch arguments, and version markers. Compare only against an identified expected artifact.

Code relationships are secondary. After the failing runtime node and deployed artifact are identified, use `ros2 pkg prefix/executables`, process metadata, launch files, and targeted `rg` searches to locate the narrow source path. Do not build or transfer a whole-repository CodeGraph. A source checkout does not prove what the running process loaded.
