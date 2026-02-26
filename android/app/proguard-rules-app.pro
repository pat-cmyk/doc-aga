    # This is the essential keep rule for the Main Activity.
    # It tells the code optimizer (R8) not to remove or rename the
    # main entry point of the application, which causes a crash on launch.
    -keep public class com.goldenforage.docaga.MainActivity {public *;
    }
