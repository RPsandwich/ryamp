import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useVisualizer } from './hooks/useVisualizer';
import { useLibrary } from './hooks/useLibrary';
import { Sidebar } from './components/Sidebar';
import { Visualizer } from './components/Visualizer';
import { TransportControls } from './components/TransportControls';
import { TrackTable } from './components/TrackTable';

function App() {
  const player = useAudioPlayer();
  const visualizer = useVisualizer(player.analyserRef, player.isPlaying);
  const lib = useLibrary();

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', display: 'flex', gap: '2rem' }}>
      <Sidebar
        libraryCount={lib.library.length}
        albumsCount={lib.albums.length}
        view={lib.view}
        playlists={lib.playlists}
        newPlaylistName={lib.newPlaylistName}
        setNewPlaylistName={lib.setNewPlaylistName}
        createPlaylist={lib.createPlaylist}
        deletePlaylist={lib.deletePlaylist}
        selectPlaylist={lib.selectPlaylist}
        openAlbums={lib.openAlbums}
        pickFolder={lib.pickFolder}
        isImporting={lib.isImporting}
        selectedFolder={lib.selectedFolder}
        importStatus={lib.importStatus}
      />

      <div style={{ flex: 1 }}>
        <Visualizer
          canvasRef={visualizer.visualizerCanvasRef}
          mode={visualizer.visualizerMode}
          setMode={visualizer.setVisualizerMode}
        />

        <TransportControls
          currentTrack={player.currentTrack}
          isPlaying={player.isPlaying}
          skipPrevious={player.skipPrevious}
          togglePlay={player.togglePlay}
          skipNext={player.skipNext}
          shuffleOn={player.shuffleOn}
          toggleShuffle={player.toggleShuffle}
          repeatMode={player.repeatMode}
          cycleRepeat={player.cycleRepeat}
        />

        <TrackTable
          view={lib.view}
          albums={lib.albums}
          openAlbum={lib.openAlbum}
          openAlbums={lib.openAlbums}
          headerLabel={lib.headerLabel}
          displayedTracks={lib.displayedTracks}
          currentTrack={player.currentTrack}
          sortKey={lib.sortKey}
          sortDir={lib.sortDir}
          handleSort={lib.handleSort}
          selectAndPlay={player.selectAndPlay}
          playlists={lib.playlists}
          addTrackToPlaylist={lib.addTrackToPlaylist}
          removeTrackFromPlaylist={lib.removeTrackFromPlaylist}
        />
      </div>
    </div>
  );
}

export default App;
